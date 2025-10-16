FROM php:8.3-apache

RUN a2enmod rewrite

WORKDIR /var/www/app

ENV APACHE_DOCUMENT_ROOT=/var/www/app/public
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/000-default.conf \
 && sed -ri -e 's/AllowOverride None/AllowOverride All/g' /etc/apache2/apache2.conf
 
RUN mkdir -p /var/www/app/public

EXPOSE 80