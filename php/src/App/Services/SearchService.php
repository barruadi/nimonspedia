<?php

namespace App\Services;

use App\Core\Database;
use PDO;

class SearchService
{
    // Synonym mapping
    private static array $synonyms = [
        'laptop' => ['notebook', 'macbook', 'lenovo', 'asus', 'acer', 'hp', 'dell', 'komputer'],
        'hp' => ['handphone', 'smartphone', 'phone', 'iphone', 'samsung', 'xiaomi', 'oppo', 'vivo'],
        'sepatu' => ['shoes', 'sneakers', 'sandal'],
        'baju' => ['shirt', 'kaos', 'pakaian', 'kemeja'],
        'celana' => ['jeans', 'pants', 'trousers'],
        'tas' => ['bag', 'backpack', 'ransel'],
        'kopi' => ['coffee'],
    ];

    // Calculate Levenshtein distance (pure PHP)
    private static function levenshtein(string $s1, string $s2): int
    {
        $len1 = mb_strlen($s1);
        $len2 = mb_strlen($s2);
        
        if ($len1 === 0) return $len2;
        if ($len2 === 0) return $len1;
        
        $matrix = [];
        
        for ($i = 0; $i <= $len1; $i++) {
            $matrix[$i] = [$i];
        }
        
        for ($j = 0; $j <= $len2; $j++) {
            $matrix[0][$j] = $j;
        }
        
        for ($i = 1; $i <= $len1; $i++) {
            for ($j = 1; $j <= $len2; $j++) {
                $cost = (mb_substr($s1, $i - 1, 1) === mb_substr($s2, $j - 1, 1)) ? 0 : 1;
                
                $matrix[$i][$j] = min(
                    $matrix[$i - 1][$j] + 1,         // deletion
                    $matrix[$i][$j - 1] + 1,         // insertion
                    $matrix[$i - 1][$j - 1] + $cost  // substitution
                );
            }
        }
        
        return $matrix[$len1][$len2];
    }

    // Calculate similarity (0.0 to 1.0)
    private static function similarity(string $s1, string $s2): float
    {
        $s1 = mb_strtolower($s1);
        $s2 = mb_strtolower($s2);
        
        if ($s1 === $s2) return 1.0;
        
        $distance = self::levenshtein($s1, $s2);
        $maxLen = max(mb_strlen($s1), mb_strlen($s2));
        
        if ($maxLen === 0) return 0.0;
        
        return 1.0 - ($distance / $maxLen);
    }

    // Expand query with synonyms
    public static function expandQuery(string $query): array
    {
        $query = mb_strtolower(trim($query));
        $terms = [$query];
        
        // Check if query or any word matches synonym keys or values
        $words = preg_split('/\s+/', $query);
        
        foreach ($words as $word) {
            if (isset(self::$synonyms[$word])) {
                $terms = array_merge($terms, self::$synonyms[$word]);
            } else {
                foreach (self::$synonyms as $key => $syns) {
                    if (in_array($word, $syns, true)) {
                        $terms[] = $key;
                        $terms = array_merge($terms, $syns);
                        break;
                    }
                }
            }
        }
        
        return array_unique($terms);
    }

    // Advanced search with fuzzy matching
    public static function search(
        string $query,
        ?string $category = null,
        ?float $minPrice = null,
        ?float $maxPrice = null,
        int $limit = 12,
        int $offset = 0
    ): array {
        $db = Database::getInstance();
        
        $query = trim($query);
        if (empty($query)) {
            return ['products' => [], 'total' => 0, 'expanded_terms' => []];
        }
        
        // Expand query with synonyms
        $expandedTerms = self::expandQuery($query);
        
        // Build SQL conditions
        $conditions = ["p.is_deleted = FALSE", "p.stock > 0"];
        $params = [];
        
        if ($category !== null && $category !== '') {
            $conditions[] = "c.name = :category";
            $params['category'] = $category;
        }
        
        if ($minPrice !== null && $minPrice > 0) {
            $conditions[] = "p.price >= :min_price";
            $params['min_price'] = (int)$minPrice;
        }
        
        if ($maxPrice !== null && $maxPrice > 0) {
            $conditions[] = "p.price <= :max_price";
            $params['max_price'] = (int)$maxPrice;
        }
        
        // Don't filter by search terms in SQL - let fuzzy matching handle it
        $whereClause = implode(' AND ', $conditions);
        
        // Get all products matching filters (without text search)
        $sql = "
            SELECT 
                p.product_id,
                p.store_id,
                p.category_id,
                p.name,
                p.description,
                p.price,
                p.stock,
                p.image_path,
                c.name as category_name,
                s.store_name,
                s.logo_path as store_logo
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.category_id
            LEFT JOIN stores s ON p.store_id = s.store_id
            WHERE {$whereClause}
            ORDER BY p.created_at DESC
        ";
        
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $allProducts = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Apply fuzzy matching and scoring
        $scoredProducts = [];
        $queryLower = mb_strtolower($query);
        
        foreach ($allProducts as $product) {
            $score = 0;
            $nameLower = mb_strtolower($product['name']);
            $descLower = mb_strtolower($product['description'] ?? '');
            $catLower = mb_strtolower($product['category_name'] ?? '');
            
            // Name Matching (Highest Priority)
            
            // 1.1 Exact match (highest score)
            if ($nameLower === $queryLower) {
                $score += 100;
            } 
            // 1.2 Starts with query
            elseif (mb_strpos($nameLower, $queryLower) === 0) {
                $score += 80;
            }
            // 1.3 Contains query anywhere in name
            elseif (mb_strpos($nameLower, $queryLower) !== false) {
                $score += 60;
            }
            // 1.4 Fuzzy match on full name
            else {
                $nameSimilarity = self::similarity($queryLower, $nameLower);
                if ($nameSimilarity >= 0.7) {
                    $score += $nameSimilarity * 70; // Max 70 points for fuzzy match
                }
            }
            
            // 1.5 Word-by-word fuzzy matching in name
            $productWords = preg_split('/\s+/', $nameLower);
            $maxWordScore = 0;
            foreach ($productWords as $word) {
                if (mb_strlen($word) < 3) continue; // Skip short words
                
                $wordSimilarity = self::similarity($queryLower, $word);
                if ($wordSimilarity >= 0.5) {
                    $maxWordScore = max($maxWordScore, $wordSimilarity * 50);
                }
            }
            $score += $maxWordScore;
            
            // Description Matching
            
            // 2.1 Exact match in description
            if (mb_strpos($descLower, $queryLower) !== false) {
                $score += 30;
            }
            // 2.2 Fuzzy match on description words
            else {
                $descWords = preg_split('/\s+/', $descLower);
                $maxDescScore = 0;
                
                foreach ($descWords as $word) {
                    if (mb_strlen($word) < 3) continue; // Skip short words
                    
                    // Check similarity with query
                    $wordSimilarity = self::similarity($queryLower, $word);
                    if ($wordSimilarity >= 0.6) { // Slightly higher threshold for description
                        $maxDescScore = max($maxDescScore, $wordSimilarity * 25);
                    }
                }
                
                $score += $maxDescScore;
            }
            
            // 2.3 Multi-word fuzzy matching in description
            // For queries with multiple words, check if description contains similar phrases
            $queryWords = preg_split('/\s+/', $queryLower);
            if (count($queryWords) > 1) {
                $matchedWords = 0;
                foreach ($queryWords as $qWord) {
                    if (mb_strlen($qWord) < 3) continue;
                    
                    foreach ($descWords as $dWord) {
                        if (mb_strlen($dWord) < 3) continue;
                        
                        if (self::similarity($qWord, $dWord) >= 0.7) {
                            $matchedWords++;
                            break;
                        }
                    }
                }
                
                // Bonus for matching multiple words in description
                if ($matchedWords > 1) {
                    $score += ($matchedWords / count($queryWords)) * 20;
                }
            }
            
            // SECTION 3: Category Matching
            
            // 3.1 Exact match in category
            if (mb_strpos($catLower, $queryLower) !== false) {
                $score += 40;
            }
            // 3.2 Fuzzy match on category
            else {
                $catSimilarity = self::similarity($queryLower, $catLower);
                if ($catSimilarity >= 0.6) {
                    $score += $catSimilarity * 35;
                }
            }
            
            // Synonym Matching
            
            foreach ($expandedTerms as $term) {
                if ($term === $queryLower) continue;
                
                // Synonym match in name
                if (mb_strpos($nameLower, $term) !== false) {
                    $score += 50;
                    break;
                } 
                // Synonym match in description
                elseif (mb_strpos($descLower, $term) !== false) {
                    $score += 30;
                    break;
                } 
                // Synonym match in category
                elseif (mb_strpos($catLower, $term) !== false) {
                    $score += 40;
                    break;
                }
                // Fuzzy synonym match in description
                else {
                    foreach ($descWords as $dWord) {
                        if (mb_strlen($dWord) < 3) continue;
                        
                        if (self::similarity($term, $dWord) >= 0.7) {
                            $score += 20;
                            break 2;
                        }
                    }
                }
            }
            
            // Only include products with score > 0
            if ($score > 0) {
                $product['relevance_score'] = round($score, 2);
                $scoredProducts[] = $product;
            }
        }
        
        // Sort by relevance score (highest first)
        usort($scoredProducts, function($a, $b) {
            return $b['relevance_score'] <=> $a['relevance_score'];
        });
        
        // Apply pagination after scoring
        $total = count($scoredProducts);
        $scoredProducts = array_slice($scoredProducts, $offset, $limit);
        
        return [
            'products' => $scoredProducts,
            'total' => $total,
            'expanded_terms' => $expandedTerms,
        ];
    }
}