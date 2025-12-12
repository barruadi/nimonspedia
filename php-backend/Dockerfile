FROM php:8.2-fpm

RUN apt-get update && apt-get install -y \
    libpng-dev \
    libjpeg-dev \
    libfreetype6-dev \
    libpq-dev \  
    zip \
    unzip \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/* # Bersihkan cache

RUN docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install gd pdo pdo_pgsql \ 
    && docker-php-ext-enable pdo_pgsql # <-- AKTIFKAN EKSTENSI

# Configure PHP upload limits
RUN echo "upload_max_filesize = 5M" >> /usr/local/etc/php/conf.d/uploads.ini \
    && echo "post_max_size = 5M" >> /usr/local/etc/php/conf.d/uploads.ini \
    && echo "memory_limit = 128M" >> /usr/local/etc/php/conf.d/uploads.ini

WORKDIR /var/www/html

COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

RUN chown -R www-data:www-data /var/www/html