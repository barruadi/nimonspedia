# Nimonspesdia
# K01 - 08

## Description

## Folder Structure
```bash
.
├── docker-compose.yml
├── Dockerfile
├── php
│   ├── php.ini
│   └── src
│       ├── app
│       │   ├── controllers
│       │   │   ├── Auth/
│       │   │   ├── Buyer/
│       │   │   └── Seller/
│       │   ├── models/
│       │   └── views/
│       ├── index.php
│       └── public
│           ├── components/
│           ├── pages/
│           ├── styles/
│           ├── api.php
│           ├── index.js
│           ├── index.html
│           └── .htaccess
└── README.md
```

## How To Run

### Prerequisites
- **Docker**

### Getting started
1) build docker images and run
```bash
docker compose up --build
```
2) Open `localhost:8080`

3) Open database inside docker
```bash
docker compose exec db bash -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```