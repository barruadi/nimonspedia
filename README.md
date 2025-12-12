# Milestone 1 Nimonspesdia

## K01 - 08

## Deskripsi Aplikasi Web

<br>
<p align="center">
  <img src="php/src/public/uploads/logo/nimonspedia.png" alt="Logo" width="400">
</p>
<br>
Nimonspedia adalah platform e-commerce ambisius yang dirancang untuk menjadi pusat perdagangan digital di dunia Nimons. Terinspirasi dari marketplace di dunia nyata, Nimonspedia memungkinkan setiap Nimons (baik Buyer maupun Seller) untuk memiliki toko digital mereka sendiri, menjual produk, dan berbelanja dengan mudah.

Aplikasi ini dibangun menggunakan **PHP murni** untuk server-side dan **HTML, CSS, & JavaScript murni** untuk *client-side*, dengan **PostgreSQL** sebagai database, dan dijalankan menggunakan Docker.

-----

## Daftar Requirement

  - **[Docker](https://docs.docker.com/get-docker/)**
  - **[Docker Compose](https://docs.docker.com/compose/install/)**

Pastikan Docker dan Docker Compose sudah terinstal di sistem Anda. Klik link untuk panduan instalasi resmi jika diperlukan.

-----

## Cara Instalasi

1.  Clone repository ini ke environment lokal Anda.
    ```bash
    git clone https://github.com/Labpro-22/milestone-1-tugas-besar-if-3110-web-based-development-k01-08.git
    cd milestone-1-tugas-besar-if-3110-web-based-development-k01-08
    ```

-----

## Cara Menjalankan Server

1.  Build dan jalankan Docker container menggunakan Docker Compose. Pastikan Anda berada di root direktori proyek (di mana file `docker-compose.yml` berada).

    ```bash
    docker compose up --build
    ```

2.  Aplikasi akan berjalan di [http://localhost:8080](https://www.google.com/search?q=http://localhost:8080).

3.  Proses *seeding* database (mengisi data awal untuk kategori, user, toko, dan produk) akan berjalan secara otomatis saat container `db` pertama kali dibuat. Skrip *seeding* dapat ditemukan di `php/db/init/02_seed.sql`.

4.  (Opsional) Untuk mengakses database PostgreSQL di dalam container:

    ```bash
    docker compose exec db bash -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
    ```

5.  Untuk menghentikan aplikasi, jalankan:

    ```bash
    docker compose down -v
    ```

-----

## Folder Structure

```bash
.
├── docker-compose.yml
├── Dockerfile
├── php
│   ├── php.ini
│   └── src
│       ├── App
│       │   ├── Controllers
│       │   │   ├── Auth/
│       │   │   ├── Buyer/
│       │   │   └── Seller/
│       │   ├── Middlewares/
│       │   ├── Models/
│       │   ├── Routes/
│       │   ├── Services/
│       │   ├── Views/
│       │   └── Core/
│       ├── bootstrap
│       │   └── bootstrap.php
│       ├── index.php
│       └── public
│           ├── components/
│           ├── pages/
│           ├── script/
│           ├── styles/
│           ├── utils/
│           ├── uploads/
│           ├── index.html
│           ├── index.js
│           └── index.php
└── README.md
```

-----

## Tangkapan Layar Tampilan Aplikasi

| Halaman | Tangkapan Layar Desktop | Tangkapan Layar Mobile |
| :--- | :---: | :---: |
| **Buyer: Login** | <img src="php/src/public/uploads/pages-desktop/login.png"> | <img src="php/src/public/uploads/pages-mobile/login.png"> |
| **Buyer: Register** | <img src="php/src/public/uploads/pages-desktop/register.png"> | <img src="php/src/public/uploads/pages-mobile/register.png"> |
| **Buyer: Product Discovery (Home)** | <img src="php/src/public/uploads/pages-desktop/products.png">| <img src="php/src/public/uploads/pages-mobile/products.png"> |
| **Buyer: Detail Produk** | <img src="php/src/public/uploads/pages-desktop/product-detail.png"> |<img src="php/src/public/uploads/pages-mobile/product-detail.png"> |
| **Buyer: Detail Toko** | <img src="php/src/public/uploads/pages-desktop/store-detail.png"> | <img src="php/src/public/uploads/pages-mobile/store-detail.png"> |
| **Buyer: Shopping Cart** | <img src="php/src/public/uploads/pages-desktop/carts.png">| <img src="php/src/public/uploads/pages-mobile/carts.png"> |
| **Buyer: Checkout** | <img src="php/src/public/uploads/pages-desktop/checkout.png"> | <img src="php/src/public/uploads/pages-mobile/checkout.png"> |
| **Buyer: Order History** | <img src="php/src/public/uploads/pages-desktop/orders.png"> | <img src="php/src/public/uploads/pages-mobile/orders.png"> |
| **Buyer: Profile** | <img src="php/src/public/uploads/pages-desktop/profile.png"> | <img src="php/src/public/uploads/pages-mobile/profile.png"> |
| **Seller: Dashboard** | <img src="php/src/public/uploads/pages-desktop/seller-dashboard.png">  | <img src="php/src/public/uploads/pages-mobile/seller-dashboard.png"> |
| **Seller: Product Management** | <img src="php/src/public/uploads/pages-desktop/seller-manajemen-produk.png">  | <img src="php/src/public/uploads/pages-mobile/seller-manajemen-produk.png"> |
| **Seller: Add Product** | <img src="php/src/public/uploads/pages-desktop/seller-add-product.png"> | <img src="php/src/public/uploads/pages-mobile/seller-add-product.png">|
| **Seller: Edit Product** | <img src="php/src/public/uploads/pages-desktop/seller-edit-product.png"> | <img src="php/src/public/uploads/pages-mobile/seller-edit-product.png"> |
| **Seller: Order Management** | <img src="php/src/public/uploads/pages-desktop/seller-manajemen-order.png"> | <img src="php/src/public/uploads/pages-mobile/seller-manajemen-order.png"> |

-----

## Penjelasan Mengenai Pembagian Tugas

### Server-side (PHP)
-   **Halaman Login (API & Autentikasi)**: 13523101
-   **Halaman Register (API & Autentikasi)**: 13523101
-   **Halaman Product Discovery (API)**: 13523101
-   **Halaman Detail Produk (API)**: 13523071
-   **Halaman Detail Store (API)**: 13523071
-   **Halaman Shopping Cart (API)**: 13523101
-   **Halaman Checkout (API)**: 13523101
-   **Halaman Order History (API)**: 13523071
-   **Halaman Profile (API)**: 13523101
-   **Halaman Dashboard (API)**: 13523013
-   **Halaman Product Management (API)**: 13523013
-   **Halaman Add Product (API)**: 13523013
-   **Halaman Edit Product (API)**: 13523013
-   **Halaman Order Management (API)**: 13523013
-   **Database (Schema, Seeding) & Docker Setup**: 13523013

### Client-side (HTML, CSS, JS)
-   **Halaman Login**: 13523101
-   **Halaman Register (Buyer & Seller)**: 13523101
-   **Halaman Product Discovery (Home)**: 13523101
-   **Halaman Detail Produk**: 13523071
-   **Halaman Detail Store**: 13523071
-   **Halaman Shopping Cart**: 13523101
-   **Halaman Checkout**: 13523101
-   **Halaman Order History (Buyer)**: 13523071
-   **Halaman Profile (Buyer)**: 13523101
-   **Halaman Dashboard (Seller)**: 13523013
-   **Halaman Product Management (Seller)**: 13523013
-   **Halaman Add Product (Seller)**: 13523013
-   **Halaman Edit Product (Seller)**: 13523013
-   **Halaman Order Management (Seller)**: 13523013
-   **Komponen Global (Navbar, Modal, Toast, Loading)**: 13523013

### Bonus
-   **All Responsive Web Design**: 13523013, 13523071, 13523101
-   **UI/UX Seperti Tokopedia**: 13523071
-   **Data Export**: 13523013
-   **Advanced Search**: 13523013

# Milestone 2 Nimonspesdia

## K01 - 08

## Deskripsi Aplikasi Web
Nimonspedia adalah platform e-commerce modern yang menggabungkan marketplace tradisional dengan fitur real-time seperti lelang (auction) dan chat. Platform ini memungkinkan Buyer dan Seller untuk bertransaksi dengan mudah, berkomunikasi secara real-time, dan berpartisipasi dalam lelang produk.

**Teknologi yang Digunakan:**
- **Frontend**: React + Vite (fitur baru), Vanilla HTML/CSS/JS (fitur legacy dari M1)
- **Backend**: PHP murni (fitur legacy), Node.js + Express (fitur real-time)
- **Database**: PostgreSQL
- **Real-time**: Socket.io (WebSocket)
- **Reverse Proxy**: Nginx
- **Containerization**: Docker & Docker Compose

**Fitur Utama:**
- Marketplace dengan sistem buyer dan seller
- Real-time auction dengan bidding system
- Real-time chat antara buyer dan seller
- Admin dashboard untuk manajemen platform
- Feature flags untuk kontrol fitur secara dinamis
- Push notifications untuk engagement pengguna

-----

## Daftar Requirement

- **[Docker](https://docs.docker.com/get-docker/)** (versi 20.10 atau lebih baru)
- **[Docker Compose](https://docs.docker.com/compose/install/)** (versi 2.0 atau lebih baru)

Pastikan Docker dan Docker Compose sudah terinstal di sistem Anda sebelum melanjutkan.

-----

## Cara Instalasi

1. Clone repository ini ke environment lokal Anda:
   ```bash
   git clone https://github.com/Labpro-22/milestone-1-tugas-besar-if-3110-web-based-development-k01-08.git
   cd milestone-1-tugas-besar-if-3110-web-based-development-k01-08
   ```

2. Pastikan file .env sudah dikonfigurasi dengan benar (sudah disediakan dalam repository).

-----

## Cara Menjalankan Server

1. Build dan jalankan Docker container menggunakan Docker Compose. Pastikan Anda berada di root direktori proyek (di mana file `docker-compose.yml` berada).
    ```bash
    docker compose up --build
    ```

2.  Aplikasi akan berjalan di [http://localhost](https://www.google.com/search?q=http://localhost).

-----

## Tangkapan Layar

[Tangkapan Layar]([https://www.google.com/search?q=http://localhost](https://drive.google.com/drive/folders/1kMIfIpUjm6n2WJzBmNUde1XaIc_kXZYo?usp=sharing))

-----

## Penjelasan Mengenai Pembagian Tugas

### Node.js Backend
-   **WebSocket Server Setup**: 13523101
-   **Auction Socker Handler**: 13523013
-   **Chat Socket Handler**: 13523101
-   **Admin Authentication (JWT)**: 13523071
-   **Admin API Endpoints**: 13523071
-   **Push Notification Service**: 13523071
-   **Scheduled Auction Checker**: 13523013

### Halaman Baru
-   **Halaman Auction List**: 13523013
-   **Halaman Auction Detail**: 13523013
-   **Halaman Seller Auction History**: 13523013
-   **Halaman Chat**: 13523101
-   **Halaman Admin Login**: 13523071
-   **Halaman Admin Dashboard**: 13523071
-   **Halaman Feature Disabled**: 13523071
-   **Payment Gateaway**: 13523101
-   **Review and Rating**: 13523101
