<?php

namespace App\Services;

use App\Core\Database;
use PDO;

class SearchService
{
    // Synonym mapping
    private static array $synonyms = [
        'laptop' => ['notebook', 'macbook', 'lenovo', 'asus', 'acer', 'hp', 'dell', 'komputer', 'computer'],
        'mouse' => ['mice', 'tetikus', 'pointing device', 'logitech', 'wireless mouse'],
        'keyboard' => ['papan ketik', 'mechanical keyboard', 'gaming keyboard', 'rgb keyboard'],
        'speaker' => ['pengeras suara', 'audio', 'sound system', 'jbl', 'bluetooth speaker'],
        'headphone' => ['headset', 'earphone', 'headphones', 'sony', 'noise canceling', 'anc'],
        'earbuds' => ['earphone', 'tws', 'true wireless', 'wireless earbuds', 'in-ear'],
        'microphone' => ['mic', 'mikrofon', 'condenser', 'usb mic', 'studio mic'],
        'webcam' => ['camera', 'kamera web', 'web camera', 'video camera', 'hd camera'],
        'hub' => ['port', 'usb hub', 'adapter', 'dongle', 'multi-port'],
        'bulb' => ['lampu', 'led', 'smart bulb', 'smart light', 'philips'],
        'mousepad' => ['alas mouse', 'gaming pad', 'mouse mat', 'desk pad'],
        'hp' => ['handphone', 'smartphone', 'phone', 'iphone', 'samsung', 'xiaomi', 'oppo', 'vivo', 'ponsel', 'telepon'],
        'case' => ['casing', 'cover', 'phone case', 'pelindung', 'protective case'],
        'screen protector' => ['tempered glass', 'anti gores', 'screen guard', 'pelindung layar'],
        'powerbank' => ['power bank', 'portable charger', 'battery bank', 'charger portabel'],
        'charger' => ['charging', 'fast charging', 'adapter', 'pengisi daya'],
        'apple' => ['apel', 'buah apel', 'fuji apple', 'malang apple'],
        'banana' => ['pisang', 'buah pisang', 'cavendish'],
        'tomato' => ['tomat', 'sayur tomat'],
        'spinach' => ['bayam', 'sayur bayam', 'baby spinach'],
        'egg' => ['telur', 'telor', 'free range eggs', 'eggs'],
        'milk' => ['susu', 'dairy', 'whole milk', 'uht milk'],
        'yogurt' => ['yoghurt', 'greek yogurt', 'yoghurt yunani'],
        'cheese' => ['keju', 'cheddar', 'dairy'],
        'kopi' => ['coffee', 'arabica', 'robusta', 'beans', 'biji kopi'],
        'teh' => ['tea', 'green tea', 'matcha', 'teh hijau'],
        'juice' => ['jus', 'orange juice', 'fresh juice', 'minuman'],
        'water' => ['air', 'air mineral', 'mineral water', 'aqua'],
        'organic' => ['organik', 'natural', 'fresh', 'segar'],
        'fresh' => ['segar', 'baru', 'organic', 'natural'],
        'baju' => ['shirt', 'kaos', 'pakaian', 'kemeja', 't-shirt', 'tshirt', 'clothing'],
        'celana' => ['jeans', 'pants', 'trousers', 'denim', 'slim fit'],
        'sepatu' => ['shoes', 'sneakers', 'footwear', 'alas kaki', 'canvas shoes'],
        'tas' => ['bag', 'backpack', 'ransel', 'tote bag', 'leather bag'],
        'belt' => ['ikat pinggang', 'sabuk', 'leather belt'],
        'dress' => ['gaun', 'pakaian wanita', 'floral dress', 'summer dress'],
        'cardigan' => ['sweater', 'outer', 'jaket tipis', 'knit cardigan'],
        'sunglasses' => ['kacamata', 'kacamata hitam', 'aviator', 'eyewear'],
        'polo' => ['polo shirt', 'kaos kerah', 'collared shirt'],
        'formal' => ['formal wear', 'office wear', 'kemeja formal', 'professional'],
        'wireless' => ['nirkabel', 'tanpa kabel', 'bluetooth', 'wifi'],
        'gaming' => ['game', 'permainan', 'esports', 'gamer'],
        'smart' => ['pintar', 'intelligent', 'iot', 'connected'],
        'portable' => ['portabel', 'mobile', 'travel', 'compact'],
        'premium' => ['berkualitas', 'high quality', 'luxury', 'mewah'],
        'murah' => ['cheap', 'affordable', 'budget', 'economical', 'terjangkau'],
        'mahal' => ['expensive', 'premium', 'luxury', 'high-end'],
        'logitech' => ['logi', 'mouse logitech', 'keyboard logitech'],
        'jbl' => ['speaker jbl', 'audio jbl', 'bluetooth jbl'],
        'sony' => ['headphone sony', 'audio sony', 'electronics sony'],
        'philips' => ['lampu philips', 'led philips', 'smart bulb philips'],
        'leather' => ['kulit', 'genuine leather', 'leather material'],
        'cotton' => ['katun', 'kapas', 'cotton material'],
        'denim' => ['jeans material', 'celana jeans', 'denim fabric'],
        'rgb' => ['led', 'colorful', 'multi-color', 'warna-warni'],
        'large' => ['besar', 'big', 'xl', 'jumbo'],
        'small' => ['kecil', 'mini', 'compact'],
        'slim' => ['ramping', 'tipis', 'slim fit'],
        'elektronik' => ['electronics', 'gadget', 'device', 'perangkat'],
        'makanan' => ['food', 'groceries', 'bahan makanan'],
        'minuman' => ['beverages', 'drinks', 'minuman'],
        'pakaian' => ['clothing', 'fashion', 'apparel', 'garment'],
        'aksesoris' => ['accessories', 'accessory', 'pelengkap'],
    ];

    // Calculate Levenshtein distance
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
        array $categories = [],      // ← always an array
        ?float $minPrice = null,
        ?float $maxPrice = null,
        int $limit = 12,
        int $offset = 0
    ): array {
        $db = Database::getInstance();
    
        $query = trim($query);
        if ($query === '') {
            return ['products' => [], 'total' => 0, 'expanded_terms' => []];
        }
    
        // Expand query with synonyms
        $expandedTerms = self::expandQuery($query);
    
        // Build SQL conditions
        $conditions = ["p.is_deleted = FALSE", "p.stock > 0"];
        $params = [];
    
        // --- Multiple categories (array) ---
        $categories = array_values(array_unique(
            array_filter(
                array_map(
                    fn($v) => mb_strtolower(trim((string)$v)),
                    $categories
                ),
                fn($v) => $v !== ''
            )
        ));
    
        if (!empty($categories)) {
            $ph = [];
            foreach ($categories as $i => $cat) {
                $key = "cat{$i}";
                $ph[] = ":{$key}";
                $params[$key] = $cat;
            }
            $conditions[] = "LOWER(c.name) IN (" . implode(', ', $ph) . ")";
        }
        // -----------------------------------
    
        if ($minPrice !== null && $minPrice > 0) {
            $conditions[] = "p.price >= :min_price";
            $params['min_price'] = (int)$minPrice;
        }
    
        if ($maxPrice !== null && $maxPrice > 0) {
            $conditions[] = "p.price <= :max_price";
            $params['max_price'] = (int)$maxPrice;
        }
    
        $whereClause = implode(' AND ', $conditions);
    
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
                c.name AS category_name,
                s.store_name,
                s.logo_path AS store_logo
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.category_id
            LEFT JOIN stores s ON p.store_id = s.store_id
            WHERE {$whereClause}
            ORDER BY p.created_at DESC
        ";
        
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $allProducts = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // ----- scoring logic unchanged (kept intact) -----
        $scoredProducts = [];
        $queryLower = mb_strtolower($query);
        
        foreach ($allProducts as $product) {
            $score = 0;
            $nameLower = mb_strtolower($product['name']);
            $descLower = mb_strtolower($product['description'] ?? '');
            $catLower  = mb_strtolower($product['category_name'] ?? '');
            $descWords = preg_split('/\s+/', $descLower);
            
            if ($nameLower === $queryLower) {
                $score += 100;
            } elseif (mb_strpos($nameLower, $queryLower) === 0) {
                $score += 80;
            } elseif (mb_strpos($nameLower, $queryLower) !== false) {
                $score += 60;
            } else {
                $nameSimilarity = self::similarity($queryLower, $nameLower);
                if ($nameSimilarity >= 0.7) $score += $nameSimilarity * 70;
            }
    
            $productWords = preg_split('/\s+/', $nameLower);
            $maxWordScore = 0;
            foreach ($productWords as $word) {
                if (mb_strlen($word) < 3) continue;
                $wordSimilarity = self::similarity($queryLower, $word);
                if ($wordSimilarity >= 0.5) $maxWordScore = max($maxWordScore, $wordSimilarity * 50);
            }
            $score += $maxWordScore;
    
            if (mb_strpos($descLower, $queryLower) !== false) {
                $score += 30;
            } else {
                $maxDescScore = 0;
                foreach ($descWords as $word) {
                    if (mb_strlen($word) < 3) continue;
                    $wordSimilarity = self::similarity($queryLower, $word);
                    if ($wordSimilarity >= 0.6) $maxDescScore = max($maxDescScore, $wordSimilarity * 25);
                }
                $score += $maxDescScore;
            }
    
            $queryWords = preg_split('/\s+/', $queryLower);
            if (count($queryWords) > 1) {
                $matchedWords = 0;
                foreach ($queryWords as $qWord) {
                    if (mb_strlen($qWord) < 3) continue;
                    foreach ($descWords as $dWord) {
                        if (mb_strlen($dWord) < 3) continue;
                        if (self::similarity($qWord, $dWord) >= 0.7) { $matchedWords++; break; }
                    }
                }
                if ($matchedWords > 1) $score += ($matchedWords / count($queryWords)) * 20;
            }
    
            if (mb_strpos($catLower, $queryLower) !== false) {
                $score += 40;
            } else {
                $catSimilarity = self::similarity($queryLower, $catLower);
                if ($catSimilarity >= 0.6) $score += $catSimilarity * 35;
            }
    
            foreach ($expandedTerms as $term) {
                if ($term === $queryLower) continue;
    
                if (mb_strpos($nameLower, $term) !== false) { $score += 50; break; }
                elseif (mb_strpos($descLower, $term) !== false) { $score += 30; break; }
                elseif (mb_strpos($catLower, $term) !== false) { $score += 40; break; }
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
            
            if ($score > 0) {
                $product['relevance_score'] = round($score, 2);
                $scoredProducts[] = $product;
            }
        }
        
        usort($scoredProducts, fn($a, $b) => $b['relevance_score'] <=> $a['relevance_score']);
        
        $total = count($scoredProducts);
        $scoredProducts = array_slice($scoredProducts, $offset, $limit);
        
        return [
            'products' => $scoredProducts,
            'total' => $total,
            'expanded_terms' => $expandedTerms,
        ];
    }
}