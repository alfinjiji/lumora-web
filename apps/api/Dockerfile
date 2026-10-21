# syntax=docker/dockerfile:1
FROM composer:2.9.5@sha256:698d3801b2a622ace460c4743c781282fcbcb733a4cbf8b31c44731e846585e8 AS composer
FROM php:8.5-fpm-bookworm@sha256:dd198c828c224e479bdaa184cdcf04a28c73d186bf5a885493bf9cc78d7196ef AS fpm
FROM php:8.5-cli-bookworm@sha256:819080ed413631f6ec564184dd9acd08d9425bd863b9f8b5876b5ea2147d55e7 AS runtime
# Keep installation in one layer, especially for cloud daemons using the vfs driver.
RUN --mount=type=secret,id=ca,mode=0444 \
    --mount=from=composer,source=/usr/bin/composer,target=/run/composer,readonly \
    set -eu; ca_file=/etc/ssl/certs/ca-certificates.crt; if [ -s /run/secrets/ca ]; then ca_file=/run/secrets/ca; fi; \
    sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list.d/debian.sources; \
    apt-get -o Acquire::https::CaInfo=$ca_file update; \
    apt-get -o Acquire::https::CaInfo=$ca_file install -y --no-install-recommends libpng-dev libjpeg62-turbo-dev libwebp-dev libfreetype6-dev libzip-dev libicu-dev libonig-dev libxml2-dev unzip git; \
    docker-php-ext-configure gd --with-jpeg --with-webp --with-freetype; \
    docker-php-ext-install -j4 pdo_mysql mbstring gd zip intl pcntl bcmath; \
    cp /run/composer /usr/local/bin/composer; \
    groupadd -g 1000 auraflare; useradd -m -u 1000 -g auraflare auraflare; \
    mkdir -p /app; chown auraflare:auraflare /app; \
    rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV PHP_INI_SCAN_DIR=/usr/local/etc/php/conf.d:/app/docker AURAFLARE_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt
USER auraflare
EXPOSE 8000
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]

FROM runtime AS production
USER root
RUN --mount=type=secret,id=ca,mode=0444 \
    --mount=from=fpm,source=/usr/local/sbin/php-fpm,target=/run/php-fpm,readonly \
    --mount=from=fpm,source=/usr/local/etc,target=/run/fpm-config,readonly \
    --mount=type=bind,source=apps/api,target=/run/source,readonly \
    set -eu; cp -R /run/source/. /app/; \
    cp /run/php-fpm /usr/local/sbin/php-fpm; cp /run/fpm-config/php-fpm.conf /usr/local/etc/; cp -R /run/fpm-config/php-fpm.d /usr/local/etc/; \
    mkdir -p storage/app/private storage/app/public storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache; \
    rm -rf /app/tests /app/phpunit.xml /app/phpstan.neon; \
    chown -R auraflare:auraflare /app; \
    if [ -s /run/secrets/ca ]; then export COMPOSER_CAFILE=/run/secrets/ca; fi; \
    su auraflare -s /bin/sh -c 'composer install --no-dev --no-interaction --prefer-dist --classmap-authoritative'
USER auraflare
EXPOSE 9000
CMD ["php-fpm", "--nodaemonize"]
