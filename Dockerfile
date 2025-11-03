FROM php:8.3-apache

RUN a2enmod rewrite

# Install dependencies for GD and PostgreSQL
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    libfreetype6-dev \
    libjpeg62-turbo-dev \
    libpng-dev \
    libwebp-dev \
    && docker-php-ext-configure gd \
        --with-freetype \
        --with-jpeg \
        --with-webp \
    && docker-php-ext-install -j$(nproc) gd pdo pdo_pgsql \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /var/www/app

ENV APACHE_DOCUMENT_ROOT=/var/www/app/public
RUN sed -ri -e "s!/var/www/html!${APACHE_DOCUMENT_ROOT}!g" /etc/apache2/sites-available/000-default.conf \
    && sed -ri -e "s/AllowOverride None/AllowOverride All/g" /etc/apache2/apache2.conf

RUN mkdir -p /var/www/app/public

EXPOSE 80