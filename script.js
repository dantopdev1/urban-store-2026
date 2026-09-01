/* =====================================================
   URBAN STORE
   PostgreSQL + Catalog + Filters + Cart + Quick View
   ===================================================== */

let cart = [];
let databaseProducts = [];
const LOCAL_CART_KEY = "urban_cart";

function saveLocalCart() {
    try {
        localStorage.setItem(
            LOCAL_CART_KEY,
            JSON.stringify(cart)
        );
    } catch (error) {
        console.warn(
            "LOCAL CART SAVE ERROR:",
            error
        );
    }
}

function loadLocalCart() {
    try {
        const saved =
            localStorage.getItem(
                LOCAL_CART_KEY
            );

        if (!saved) {
            return [];
        }

        const parsed =
            JSON.parse(saved);

        return Array.isArray(parsed)
            ? parsed
            : [];

    } catch (error) {
        console.warn(
            "LOCAL CART LOAD ERROR:",
            error
        );

        return [];
    }
}

function clearLocalCart() {
    try {
        localStorage.removeItem(
            LOCAL_CART_KEY
        );
    } catch (error) {
        console.warn(
            "LOCAL CART CLEAR ERROR:",
            error
        );
    }
}
let currentQuickViewProduct = null;
let currentQuickViewImages = [];
let currentQuickViewImageIndex = 0;


/* =====================================================
   ELEMENTS
   ===================================================== */

const cartButton = document.querySelector(".cart-button");
const cartModal = document.getElementById("cart-modal");
const closeCart = document.getElementById("close-cart");
const cartOverlay = document.getElementById("cart-overlay");

const cartCount = document.getElementById("cart-count");
const cartItems = document.getElementById("cart-items");
const cartTotal = document.getElementById("cart-total");
const clearCart = document.getElementById("clear-cart");

const searchButton = document.getElementById("search-button");
const searchPanel = document.getElementById("search-panel");
const closeSearch = document.getElementById("close-search");
const searchInput = document.getElementById("search-input");

const newsletterForm =
    document.getElementById("newsletter-form");

const quickViewOverlay =
    document.getElementById("quick-view-overlay");

const quickViewClose =
    document.getElementById("quick-view-close");

const quickViewImage =
    document.getElementById("quick-view-image");

const quickViewCategory =
    document.getElementById("quick-view-category");

const quickViewName =
    document.getElementById("quick-view-name");

const quickViewDescription =
    document.getElementById("quick-view-description");

const quickViewStock =
    document.getElementById("quick-view-stock");

const quickViewPrice =
    document.getElementById("quick-view-price");

const quickViewAdd =
    document.getElementById("quick-view-add");


/* =====================================================
   HELPERS
   ===================================================== */

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =====================================================
   PRODUCT IMAGES
   ===================================================== */

function getProductImages(product) {

    let images = [];

    if (Array.isArray(product.images)) {
        images = product.images;
    }

    else if (typeof product.images === "string") {

        try {

            const parsed =
                JSON.parse(product.images);

            if (Array.isArray(parsed)) {
                images = parsed;
            }

        } catch {

            images = product.images
                .split(",")
                .map(image => image.trim())
                .filter(Boolean);
        }
    }

    [
        product.image,
        product.image1,
        product.image2,
        product.image3,
        product.image4,
        product.image5
    ].forEach(image => {

        if (
            typeof image === "string" &&
            image.trim()
        ) {
            images.push(image.trim());
        }

    });

    images = [
        ...new Set(
            images.filter(Boolean)
        )
    ];

    if (images.length === 0) {

        images.push(
            "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=1200&q=90"
        );

    }

    return images;
}


/* =====================================================
   REMOVE DUPLICATES
   ===================================================== */

function removeDuplicateProducts(products) {

    const uniqueProducts = [];

    const usedIds = new Set();
    const usedKeys = new Set();

    products.forEach(product => {

        if (
            product.id !== undefined &&
            product.id !== null
        ) {

            const id = String(product.id);

            if (usedIds.has(id)) {
                return;
            }

            usedIds.add(id);
        }

        const images =
            getProductImages(product);

        const name =
            String(product.name || "")
                .trim()
                .toLowerCase();

        const key =
            `${name}|${images[0]}`;

        if (usedKeys.has(key)) {
            return;
        }

        usedKeys.add(key);

        uniqueProducts.push(product);

    });

    return uniqueProducts;
}


/* =====================================================
   CART
   ===================================================== */

function renderCart() {

    if (cartCount) {

        const count =
            cart.reduce(
                (sum, item) =>
                    sum + item.quantity,
                0
            );

        cartCount.textContent = count;
    }

    if (!cartItems) {
        return;
    }

    cartItems.innerHTML = "";

    if (cart.length === 0) {

        cartItems.innerHTML = `
            <p style="
                color:#777;
                padding:30px 0;
                text-align:center;
            ">
                Корзина пуста.
            </p>
        `;

        if (cartTotal) {
            cartTotal.textContent = "0.00";
        }

        return;
    }

    let total = 0;

    cart.forEach((item, index) => {

        const price =
            Number(item.price) || 0;

        total +=
            price * item.quantity;

        const row =
            document.createElement("div");

        row.className = "cart-item";

        row.innerHTML = `
            <div>

                <strong>
                    ${escapeHTML(item.name)}
                </strong>

                <div style="
                    margin-top:5px;
                    color:#111;
                    font-size:11px;
                ">
                    Размер:
                    ${escapeHTML(
                        item.size || "S"
                    )}
                </div>

                <div style="
                    margin-top:6px;
                    color:#777;
                    font-size:11px;
                ">
                    ${price.toFixed(2)} zł
                    × ${item.quantity}
                </div>

            </div>

            <button
                class="remove-cart-item"
                data-index="${index}"
                type="button"
            >
                ×
            </button>
        `;

        cartItems.appendChild(row);

    });

    if (cartTotal) {

        cartTotal.textContent =
            total.toFixed(2);

    }

    document
        .querySelectorAll(".remove-cart-item")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const index =
                        Number(
                            button.dataset.index
                        );

                    const removed =
                        cart[index];

                    cart.splice(index, 1);

                    renderCart();
                    saveLocalCart();
                    if (removed?.id) {

                        fetch(
                            `/api/cart/${removed.id}`,
                            {
                                method: "DELETE",
                                credentials: "include"
                            }
                        ).catch(error => {

                            console.warn(
                                "Ошибка удаления с сервера:",
                                error
                            );

                        });

                    }

                }
            );

        });

}


/* =====================================================
   LOAD CART
   ===================================================== */

async function loadCart() {

    try {

        const response =
            await fetch(
                "/api/cart",
                {
                    credentials:
                        "include"
                }
            );

        if (
            response.status === 401
        ) {

            return;
        }

        const data =
            await response.json();

        if (
            !response.ok ||
            !data.success
        ) {

            console.warn(
                "Не удалось загрузить корзину:",
                data.message
            );

            return;
        }

        const serverCart =
            Array.isArray(data.cart)
                ? data.cart
                : [];
const localCart = loadLocalCart();

if (serverCart.length === 0 && localCart.length > 0) {
    cart = localCart;
    renderCart();
    return;
}
        cart =
            serverCart.map(item => ({
                id:
                    item.product_id ??
                    item.id,

                name:
                    item.name ||
                    "URBAN",

                price:
                    Number(
                        item.price
                    ) || 0,

                size:
                    item.size ||
                    "S",

                quantity:
                    Number(
                        item.quantity
                    ) || 1
            }));

        renderCart();

        console.log(
            "CART: загружена с сервера",
            cart
        );

    } catch (error) {

        console.warn(
            "LOAD CART ERROR:",
            error
        );
    }
}


/* =====================================================
   ADD TO CART
   ===================================================== */

async function addToCart(
    product,
    selectedSize = null
) {

    const size =
        selectedSize || "S";

    const existing =
        cart.find(
            item =>
                String(item.id) ===
                    String(product.id) &&
                item.size === size
        );

    if (existing) {

        existing.quantity++;

    } else {

        cart.push({

            id: product.id,

            name: product.name,

            price:
                Number(
                    product.price
                ) || 0,

            size,

            quantity: 1

        });
    }

    renderCart();
    saveLocalCart();
    try {

        const response =
            await fetch(
                "/api/cart",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    credentials:
                        "include",

                    body:
                        JSON.stringify({
                            productId:
                                product.id,

                            quantity: 1,

                            size
                        })
                }
            );

        if (
            response.status === 401
        ) {

            console.warn(
                "Пользователь не вошёл в аккаунт"
            );

        }

        else if (
            !response.ok
        ) {

            let data = null;

            try {
                data =
                    await response.json();
            } catch {
                // ignore
            }

            console.warn(
                "Не удалось сохранить товар на сервере:",
                response.status,
                data?.message || ""
            );
        }

    } catch (error) {

        console.warn(
            "Ошибка сохранения корзины на сервере:",
            error
        );
    }
}


/* =====================================================
   QUICK VIEW GALLERY
   ===================================================== */

function createQuickViewGallery() {

    const imageContainer =
        document.querySelector(
            ".quick-view-image"
        );

    if (!imageContainer) {
        return;
    }

    let thumbnails =
        imageContainer.querySelector(
            ".quick-view-thumbnails"
        );

    if (!thumbnails) {

        thumbnails =
            document.createElement(
                "div"
            );

        thumbnails.className =
            "quick-view-thumbnails";

        imageContainer.appendChild(
            thumbnails
        );
    }

    thumbnails.innerHTML = "";

    currentQuickViewImages.forEach(
        (image, index) => {

            const thumbnail =
                document.createElement(
                    "button"
                );

            thumbnail.type =
                "button";

            thumbnail.className =
                "quick-view-thumbnail";

            if (
                index ===
                currentQuickViewImageIndex
            ) {

                thumbnail.classList.add(
                    "active"
                );
            }

            thumbnail.innerHTML = `
                <img
                    src="${escapeHTML(image)}"
                    alt=""
                >
            `;

            thumbnail.addEventListener(
                "click",
                () => {

                    showQuickViewImage(
                        index
                    );

                }
            );

            thumbnails.appendChild(
                thumbnail
            );

        }
    );
}


/* =====================================================
   SHOW QUICK VIEW IMAGE
   ===================================================== */

function showQuickViewImage(index) {

    if (
        !currentQuickViewImages.length ||
        !quickViewImage
    ) {
        return;
    }

    if (
        index < 0 ||
        index >=
            currentQuickViewImages.length
    ) {
        return;
    }

    currentQuickViewImageIndex =
        index;

    quickViewImage.src =
        currentQuickViewImages[index];

    document
        .querySelectorAll(
            ".quick-view-thumbnail"
        )
        .forEach(
            (
                thumbnail,
                thumbnailIndex
            ) => {

                thumbnail.classList.toggle(
                    "active",
                    thumbnailIndex === index
                );

            }
        );
}


/* =====================================================
   OPEN QUICK VIEW
   ===================================================== */

function openQuickView(product) {

    if (!quickViewOverlay) {
        return;
    }

    currentQuickViewProduct =
        product;

    currentQuickViewImages =
        getProductImages(product);

    currentQuickViewImageIndex =
        0;

    if (quickViewName) {

        quickViewName.textContent =
            product.name ||
            "URBAN";
    }

    if (quickViewDescription) {

        quickViewDescription.textContent =
            product.description ||
            "Качественная одежда для повседневного городского стиля.";
    }

    if (quickViewCategory) {

        quickViewCategory.textContent =
            product.category ||
            "URBAN";
    }

    if (quickViewPrice) {

        const price =
            Number(
                product.price
            ) || 0;

        quickViewPrice.textContent =
            `${price.toFixed(2)} zł`;
    }

    const stock =
        Number(
            product.stock
        ) || 0;

    if (quickViewStock) {

        quickViewStock.textContent =
            stock;
            /* =====================================================
           SIZE SELECTOR
        ===================================================== */

        const sizes =
            Array.isArray(
                product.sizes
            )
                ? product.sizes
                : [
                    "S",
                    "M",
                    "L",
                    "XL"
                ];

        let quickViewSizes =
            document.querySelector(
                ".quick-view-sizes"
            );

        if (!quickViewSizes) {

            quickViewSizes =
                document.createElement(
                    "div"
                );

            quickViewSizes.className =
                "quick-view-sizes";

            const quickViewBottom =
                document.querySelector(
                    ".quick-view-bottom"
                );

            if (quickViewBottom) {

                quickViewBottom.insertBefore(
                    quickViewSizes,
                    quickViewBottom.firstChild
                );
            }
        }

        quickViewSizes.innerHTML = `
            <div class="quick-view-size-title">
                РАЗМЕР
            </div>

            <div class="quick-view-size-list">

                ${sizes
                    .map(
                        (
                            size,
                            index
                        ) => `
                            <button
                                type="button"
                                class="quick-view-size ${
                                    index === 0
                                        ? "active"
                                        : ""
                                }"
                                data-size="${escapeHTML(size)}"
                            >
                                ${escapeHTML(size)}
                            </button>
                        `
                    )
                    .join("")}

            </div>
        `;

        quickViewSizes
            .querySelectorAll(
                ".quick-view-size"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            quickViewSizes
                                .querySelectorAll(
                                    ".quick-view-size"
                                )
                                .forEach(
                                    item => {

                                        item.classList.remove(
                                            "active"
                                        );

                                    }
                                );

                            button.classList.add(
                                "active"
                            );

                        }
                    );

                }
            );
    }

    if (quickViewImage) {

        quickViewImage.src =
            currentQuickViewImages[0];

        quickViewImage.alt =
            product.name ||
            "URBAN";

        quickViewImage.onerror =
            function () {

                this.onerror =
                    null;

                this.src =
                    "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=1200&q=90";

            };
    }

    createQuickViewGallery();

    if (quickViewAdd) {

        if (stock <= 0) {

            quickViewAdd.disabled =
                true;

            quickViewAdd.textContent =
                "НЕТ В НАЛИЧИИ";

        } else {

            quickViewAdd.disabled =
                false;

            quickViewAdd.textContent =
                "ДОБАВИТЬ В КОРЗИНУ";
        }
    }

    quickViewOverlay.classList.add(
        "open"
    );

    document.body.classList.add(
        "no-scroll"
    );
}


/* =====================================================
   CLOSE QUICK VIEW
   ===================================================== */

function closeQuickView() {

    if (!quickViewOverlay) {
        return;
    }

    quickViewOverlay.classList.remove(
        "open"
    );

    document.body.classList.remove(
        "no-scroll"
    );

    currentQuickViewProduct =
        null;
}


/* =====================================================
   CREATE PRODUCT CARD
   ===================================================== */

function createProductCard(
    product,
    index
) {

    const card =
        document.createElement(
            "article"
        );

    card.className =
        "product";

    card.dataset.category =
        product.category ||
        "all";

    card.style.animationDelay =
        `${index * 0.04}s`;

    const images =
        getProductImages(product);

    const price =
        Number(
            product.price
        ) || 0;

    const stock =
        Number(
            product.stock
        ) || 0;

    const outOfStock =
        stock <= 0;

    card.innerHTML = `

        <div class="product-image-wrapper">

            <img
                src="${escapeHTML(images[0])}"
                alt="${escapeHTML(
                    product.name ||
                    "URBAN"
                )}"
                class="product-image"
            >

            <button
                class="product-favorite"
                type="button"
                aria-label="Добавить в избранное"
            >
                ♡
            </button>

            ${
                product.badge
                    ? `
                        <span class="product-badge">
                            ${escapeHTML(
                                product.badge
                            )}
                        </span>
                    `
                    : ""
            }

            <button
                class="quick-view-button"
                type="button"
            >
                БЫСТРЫЙ ПРОСМОТР
            </button>

        </div>

        <div class="product-info">

            <div class="product-title-row">

                <h3>
                    ${escapeHTML(
                        product.name ||
                        "URBAN"
                    )}
                </h3>

            </div>

            <p>
                ${escapeHTML(
                    product.description ||
                    ""
                )}
            </p>

            <div class="product-bottom">

                <span class="product-price">
                    ${price.toFixed(2)} zł
                </span>

                ${
                    outOfStock
                        ? `
                            <button
                                class="add-to-cart"
                                disabled
                                type="button"
                            >
                                НЕТ В НАЛИЧИИ
                            </button>
                        `
                        : `
                            <button
                                class="add-to-cart"
                                type="button"
                            >
                                ДОБАВИТЬ
                            </button>
                        `
                }

            </div>

        </div>
    `;

    const image =
        card.querySelector(
            ".product-image"
        );

    if (image) {

        image.addEventListener(
            "error",
            function () {

                this.onerror =
                    null;

                this.src =
                    "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=1200&q=90";

            }
        );
    }

    const quickButton =
        card.querySelector(
            ".quick-view-button"
        );

    if (quickButton) {

        quickButton.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                openQuickView(
                    product
                );

            }
        );
    }

    const button =
        card.querySelector(
            ".add-to-cart"
        );

    if (
        button &&
        !outOfStock
    ) {

        button.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                addToCart(
                    product
                );

                const oldText =
                    button.textContent;

                button.textContent =
                    "ДОБАВЛЕНО ✓";

                setTimeout(
                    () => {

                        button.textContent =
                            oldText;

                    },
                    900
                );

            }
        );
    }

    const favorite =
        card.querySelector(
            ".product-favorite"
        );

    if (favorite) {

        favorite.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                favorite.classList.toggle(
                    "active"
                );

                favorite.textContent =
                    favorite.classList.contains(
                        "active"
                    )
                        ? "♥"
                        : "♡";

            }
        );
    }

    return card;
}


/* =====================================================
   RENDER PRODUCTS
   ===================================================== */

function renderProducts(
    products
) {

    const container =
        document.querySelector(
            "#products-grid"
        );

    if (!container) {

        console.error(
            "#products-grid не найден"
        );

        return;
    }

    container.innerHTML = "";

    const uniqueProducts =
        removeDuplicateProducts(
            products
        );

    if (
        uniqueProducts.length === 0
    ) {

        container.innerHTML = `

            <div style="
                grid-column:1/-1;
                padding:100px 20px;
                text-align:center;
            ">

                <h3>
                    Товаров пока нет
                </h3>

            </div>
        `;

        return;
    }

    uniqueProducts.forEach(
        (
            product,
            index
        ) => {

            const card =
                createProductCard(
                    product,
                    index
                );

            container.appendChild(
                card
            );
        }
    );
        console.log(
        "Отображено товаров:",
        uniqueProducts.length
    );
}


/* =====================================================
   LOAD PRODUCTS
   ===================================================== */

async function loadProducts() {

    console.log(
        "Загрузка товаров из PostgreSQL..."
    );

    try {

        const response =
            await fetch(
                "/products"
            );

        if (!response.ok) {

            throw new Error(
                `Ошибка сервера: ${response.status}`
            );
        }

        const products =
            await response.json();

        if (
            !Array.isArray(products)
        ) {

            throw new Error(
                "Сервер вернул неправильный формат товаров"
            );
        }

        databaseProducts =
            removeDuplicateProducts(
                products
            );

        console.log(
            "Получено товаров:",
            products.length
        );

        console.log(
            "После удаления дублей:",
            databaseProducts.length
        );

        renderProducts(
            databaseProducts
        );

    } catch (error) {

        console.error(
            "ОШИБКА ЗАГРУЗКИ ТОВАРОВ:",
            error
        );

        const container =
            document.querySelector(
                "#products-grid"
            );

        if (container) {

            container.innerHTML = `

                <div style="
                    grid-column:1/-1;
                    padding:100px 20px;
                    text-align:center;
                ">

                    <h3>
                        Не удалось загрузить товары
                    </h3>

                    <p style="
                        margin-top:15px;
                        color:#777;
                    ">
                        Проверь, запущен ли сервер.
                    </p>

                </div>
            `;
        }
    }
}


/* =====================================================
   FILTERS
   ===================================================== */

function setupFilters() {

    const buttons =
        document.querySelectorAll(
            ".category-btn"
        );

    console.log(
        "Найдено кнопок:",
        buttons.length
    );

    buttons.forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    const text =
                        button.textContent
                            .trim()
                            .toLowerCase();

                    const dataCategory =
                        String(
                            button.dataset.category ||
                            ""
                        )
                            .trim()
                            .toLowerCase();

                    buttons.forEach(
                        item => {

                            item.classList.remove(
                                "active"
                            );
                        }
                    );

                    button.classList.add(
                        "active"
                    );

                    if (
                        text === "каталог" ||
                        text === "все" ||
                        dataCategory === "all"
                    ) {

                        renderProducts(
                            databaseProducts
                        );

                        return;
                    }

                    if (
                        text === "мужское" ||
                        text === "мужчины" ||
                        dataCategory === "male" ||
                        dataCategory === "men" ||
                        dataCategory === "мужское"
                    ) {

                        const filtered =
                            databaseProducts.filter(
                                product => {

                                    const gender =
                                        String(
                                            product.gender ||
                                            ""
                                        )
                                            .trim()
                                            .toLowerCase();

                                    return (
                                        gender === "male" ||
                                        gender === "мужское" ||
                                        gender === "men"
                                    );
                                }
                            );

                        renderProducts(
                            filtered
                        );

                        return;
                    }

                    if (
                        text === "женское" ||
                        text === "женщины" ||
                        dataCategory === "female" ||
                        dataCategory === "women" ||
                        dataCategory === "женское"
                    ) {

                        const filtered =
                            databaseProducts.filter(
                                product => {

                                    const gender =
                                        String(
                                            product.gender ||
                                            ""
                                        )
                                            .trim()
                                            .toLowerCase();

                                    return (
                                        gender === "female" ||
                                        gender === "женское" ||
                                        gender === "women"
                                    );
                                }
                            );

                        renderProducts(
                            filtered
                        );

                        return;
                    }

                    if (
                        text === "новинки"
                    ) {

                        const filtered =
                            databaseProducts.filter(
                                product =>
                                    product.is_new === true ||
                                    product.is_new === "true" ||
                                    product.is_new === 1
                            );

                        renderProducts(
                            filtered
                        );

                        return;
                    }

                    if (
                        text === "sale" ||
                        text === "скидки" ||
                        text === "распродажа"
                    ) {

                        const filtered =
                            databaseProducts.filter(
                                product =>
                                    product.is_sale === true ||
                                    product.is_sale === "true" ||
                                    product.is_sale === 1
                            );

                        renderProducts(
                            filtered
                        );

                        return;
                    }

                    const filtered =
                        databaseProducts.filter(
                            product => {

                                const category =
                                    String(
                                        product.category ||
                                        ""
                                    )
                                        .trim()
                                        .toLowerCase();

                                return (
                                    category ===
                                        dataCategory ||
                                    category ===
                                        text
                                );
                            }
                        );

                    renderProducts(
                        filtered
                    );
                }
            );
        }
    );
}


/* =====================================================
   CART OPEN
   ===================================================== */

if (cartButton) {

    cartButton.addEventListener(
        "click",
        () => {

            if (cartModal) {

                cartModal.classList.add(
                    "open"
                );
            }

            if (cartOverlay) {

                cartOverlay.classList.add(
                    "open"
                );
            }
        }
    );
}


/* =====================================================
   CART CLOSE
   ===================================================== */

function closeCartModal() {

    if (cartModal) {

        cartModal.classList.remove(
            "open"
        );
    }

    if (cartOverlay) {

        cartOverlay.classList.remove(
            "open"
        );
    }
}

if (closeCart) {

    closeCart.addEventListener(
        "click",
        closeCartModal
    );
}

if (cartOverlay) {

    cartOverlay.addEventListener(
        "click",
        closeCartModal
    );
}


/* =====================================================
   CLEAR CART
   ===================================================== */

if (clearCart) {

    clearCart.addEventListener(
        "click",
        async () => {

            cart = [];

            renderCart();
            clearLocalCart();
            try {

                await fetch(
                    "/api/cart",
                    {
                        method:
                            "DELETE",

                        credentials:
                            "include"
                    }
                );

            } catch (error) {

                console.warn(
                    "Ошибка очистки корзины на сервере:",
                    error
                );
            }
        }
    );
}


/* =====================================================
   QUICK VIEW CLOSE
   ===================================================== */

if (quickViewClose) {

    quickViewClose.addEventListener(
        "click",
        closeQuickView
    );
}

if (quickViewOverlay) {

    quickViewOverlay.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                quickViewOverlay
            ) {

                closeQuickView();
            }
        }
    );
}


/* =====================================================
   QUICK VIEW ADD
   ===================================================== */

if (quickViewAdd) {

    quickViewAdd.addEventListener(
        "click",
        () => {

            if (
                !currentQuickViewProduct
            ) {

                return;
            }

            const stock =
                Number(
                    currentQuickViewProduct.stock
                ) || 0;

            if (stock <= 0) {

                return;
            }

            const selectedSizeButton =
                document.querySelector(
                    ".quick-view-size.active"
                );

            const selectedSize =
                selectedSizeButton?.dataset
                    .size || "S";

            addToCart(
                currentQuickViewProduct,
                selectedSize
            );

            quickViewAdd.textContent =
                "ДОБАВЛЕНО ✓";

            setTimeout(
                () => {

                    if (quickViewAdd) {

                        quickViewAdd.textContent =
                            "ДОБАВИТЬ В КОРЗИНУ";
                    }

                },
                1000
            );
        }
    );
}


/* =====================================================
   SEARCH
   ===================================================== */

if (searchButton) {

    searchButton.addEventListener(
        "click",
        () => {

            if (!searchPanel) {
                return;
            }

            searchPanel.classList.toggle(
                "open"
            );

            if (
                searchPanel.classList.contains(
                    "open"
                ) &&
                searchInput
            ) {

                searchInput.focus();
            }
        }
    );
}

if (closeSearch) {

    closeSearch.addEventListener(
        "click",
        () => {

            if (searchPanel) {

                searchPanel.classList.remove(
                    "open"
                );
            }
        }
    );
}

if (searchInput) {

    searchInput.addEventListener(
        "input",
        () => {

            const query =
                searchInput.value
                    .toLowerCase()
                    .trim();

            if (!query) {

                renderProducts(
                    databaseProducts
                );

                return;
            }

            const filtered =
                databaseProducts.filter(
                    product => {

                        const name =
                            String(
                                product.name ||
                                ""
                            )
                                .toLowerCase();

                        const description =
                            String(
                                product.description ||
                                ""
                            )
                                .toLowerCase();

                        return (
                            name.includes(
                                query
                            ) ||
                            description.includes(
                                query
                            )
                        );
                    }
                );

            renderProducts(
                filtered
            );
        }
    );
}
/* =====================================================
   NEWSLETTER
   ===================================================== */

if (newsletterForm) {

    newsletterForm.addEventListener(
        "submit",
        event => {

            event.preventDefault();

            const button =
                newsletterForm.querySelector(
                    "button"
                );

            if (!button) {
                return;
            }

            const oldText =
                button.textContent;

            button.textContent =
                "ГОТОВО ✓";

            setTimeout(
                () => {

                    button.textContent =
                        oldText;

                    newsletterForm.reset();

                },
                1500
            );
        }
    );
}


/* =====================================================
   ESCAPE
   ===================================================== */

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Escape"
        ) {

            closeQuickView();

            closeCartModal();

            if (searchPanel) {

                searchPanel.classList.remove(
                    "open"
                );
            }
        }
    }
);


/* =====================================================
   START
   ===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupFilters();
const localCart = loadLocalCart();

if (localCart.length) {
    cart = localCart;
}
        renderCart();

      
      loadProducts();

        console.log(
            "URBAN STORE запущен ✓"
        );
    }
);


/* =====================================================
   LOGIN
===================================================== */

const loginForm =
    document.getElementById(
        "login-form"
    );

const loginMessage =
    document.getElementById(
        "login-message"
    );

const loginView =
    document.getElementById(
        "login-view"
    );

const userView =
    document.getElementById(
        "user-view"
    );

const userName =
    document.getElementById(
        "user-name"
    );

const userEmail =
    document.getElementById(
        "user-email"
    );


/* =====================================================
   LOGIN SUBMIT
===================================================== */

if (loginForm) {

    loginForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            const emailInput =
                document.getElementById(
                    "login-email"
                );

            const passwordInput =
                document.getElementById(
                    "login-password"
                );

            const email =
                emailInput
                    ? emailInput.value.trim()
                    : "";

            const password =
                passwordInput
                    ? passwordInput.value
                    : "";

            if (
                !email ||
                !password
            ) {

                if (loginMessage) {

                    loginMessage.textContent =
                        "Заполни все поля";
                }

                return;
            }

            try {

                const response =
                    await fetch(
                        "/api/login",
                        {
                            method:
                                "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            credentials:
                                "include",

                            body:
                                JSON.stringify({
                                    email,
                                    password
                                })
                        }
                    );

                let data = null;

                try {

                    data =
                        await response.json();

                } catch {

                    data = null;
                }

                if (
                    !response.ok ||
                    !data ||
                    !data.success
                ) {

                    if (loginMessage) {

                        loginMessage.textContent =
                            data?.message ||
                            `Ошибка входа: ${response.status}`;
                    }

                    return;
                }

                if (loginMessage) {

                    loginMessage.textContent =
                        "Вход выполнен ✓";
                }

                if (userName) {

                    userName.textContent =
                        data.user?.name ||
                        "Пользователь";
                }

                if (userEmail) {

                    userEmail.textContent =
                        data.user?.email ||
                        "";
                }

                if (loginView) {

                    loginView.classList.remove(
                        "active"
                    );
                }

                if (userView) {

                    userView.classList.add(
                        "active"
                    );
                }

                console.log(
                    "LOGIN: успешно",
                    data.user
                );

                await loadCart();

            } catch (error) {

                console.error(
                    "LOGIN ERROR:",
                    error
                );

                if (loginMessage) {

                    loginMessage.textContent =
                        "Ошибка соединения с сервером";
                }
            }
        }
    );
}

/* =====================================================
   LOGOUT
===================================================== */

document.addEventListener("click", async (event) => {

    const target =
        event.target instanceof Element
            ? event.target
            : null;

    if (!target) {
        return;
    }

    const logoutButton =
        target.closest(
            "#logout, #logout-button, .logout-button, [data-action='logout']"
        );

    if (!logoutButton) {
        return;
    }

    event.preventDefault();

    try {

        const response = await fetch(
            "/api/logout",
            {
                method: "POST",
                credentials: "include"
            }
        );

        let data = null;

        try {
            data = await response.json();
        } catch {
            data = null;
        }

        if (!response.ok) {

            console.error(
                "LOGOUT ERROR:",
                response.status,
                data
            );

            return;
        }

        console.log("LOGOUT: успешно");

        cart = [];

        localStorage.removeItem("urban_cart");

        renderCart();

        if (userView) {
            userView.classList.remove("active");
        }

        if (loginView) {
            loginView.classList.add("active");
        }

    } catch (error) {

        console.error(
            "LOGOUT ERROR:",
            error
        );

    }

});
/* =====================================================
   RESTORE SESSION
===================================================== */

(async function restoreSession() {

    try {

        const response =
            await fetch(
                "/api/me",
                {
                    credentials:
                        "include"
                }
            );

        if (
            !response.ok
        ) {
            return;
        }

        const data =
            await response.json();

        if (
            !data.loggedIn ||
            !data.user
        ) {

            return;
        }

        if (userName) {

            userName.textContent =
                data.user.name ||
                "Пользователь";
        }

        if (userEmail) {

            userEmail.textContent =
                data.user.email ||
                "";
        }

        if (loginView) {

            loginView.classList.remove(
                "active"
            );
        }

        if (userView) {

            userView.classList.add(
                "active"
            );
        }

        console.log(
            "SESSION: восстановлена",
            data.user
        );

        await loadCart();

    } catch (error) {

        console.warn(
            "SESSION RESTORE ERROR:",
            error
        );
    }

})();


/* =====================================================
   CHECKOUT BUTTON
===================================================== */

document.addEventListener(
    "click",
    event => {

        const target =
            event.target instanceof Element
                ? event.target
                : null;

        if (!target) {
            return;
        }

        const checkoutButton =
            target.closest(
                ".checkout-button"
            );

        if (!checkoutButton) {
            return;
        }

        console.log(
            "CHECKOUT: кнопка нажата"
        );

        if (
            !cart ||
            cart.length === 0
        ) {

            alert(
                "Корзина пуста"
            );

            return;
        }

        const checkoutWindow =
            document.createElement(
                "div"
            );

        checkoutWindow.style.position =
            "fixed";

        checkoutWindow.style.inset =
            "0";

        checkoutWindow.style.background =
            "rgba(0,0,0,0.55)";

        checkoutWindow.style.zIndex =
            "99999";

        checkoutWindow.style.display =
            "flex";

        checkoutWindow.style.alignItems =
            "center";

        checkoutWindow.style.justifyContent =
            "center";

        checkoutWindow.style.padding =
            "20px";

        const total =
            cart.reduce(
                (
                    sum,
                    item
                ) =>
                    sum +
                    (
                        Number(
                            item.price
                        ) || 0
                    ) *
                    Number(
                        item.quantity ||
                        0
                    ),
                0
            );

        checkoutWindow.innerHTML = `
            <div
                style="
                    width:100%;
                    max-width:520px;
                    max-height:90vh;
                    overflow-y:auto;
                    background:#fff;
                    padding:35px;
                    box-sizing:border-box;
                    position:relative;
                "
            >

                <button
                    type="button"
                    id="checkout-close"
                    style="
                        position:absolute;
                        top:15px;
                        right:18px;
                        border:0;
                        background:none;
                        font-size:28px;
                        cursor:pointer;
                    "
                >
                    ×
                </button>

                <p
                    style="
                        font-size:11px;
                        letter-spacing:3px;
                        color:#777;
                        margin:0 0 10px;
                    "
                >
                    URBAN STORE
                </p>
                <h2
                    style="
                        margin:0 0 30px;
                        font-size:30px;
                    "
                >
                    Оформление заказа
                </h2>

                <form id="checkout-form">

                    <label
                        style="
                            display:block;
                            margin-bottom:18px;
                            font-size:13px;
                        "
                    >
                        Имя

                        <input
                            id="checkout-name"
                            type="text"
                            required
                            style="
                                width:100%;
                                box-sizing:border-box;
                                margin-top:7px;
                                padding:13px;
                                border:1px solid #ddd;
                                font-size:14px;
                            "
                        >
                    </label>

                    <label
                        style="
                            display:block;
                            margin-bottom:18px;
                            font-size:13px;
                        "
                    >
                        Телефон

                        <input
                            id="checkout-phone"
                            type="tel"
                            placeholder="+48 000 000 000"
                            required
                            style="
                                width:100%;
                                box-sizing:border-box;
                                margin-top:7px;
                                padding:13px;
                                border:1px solid #ddd;
                                font-size:14px;
                            "
                        >
                    </label>

                    <label
                        style="
                            display:block;
                            margin-bottom:18px;
                            font-size:13px;
                        "
                    >
                        Email

                        <input
                            id="checkout-email"
                            type="email"
                            required
                            style="
                                width:100%;
                                box-sizing:border-box;
                                margin-top:7px;
                                padding:13px;
                                border:1px solid #ddd;
                                font-size:14px;
                            "
                        >
                    </label>

                    <label
                        style="
                            display:block;
                            margin-bottom:18px;
                            font-size:13px;
                        "
                    >
                        Способ доставки

                        <select
                            id="checkout-delivery"
                            required
                            style="
                                width:100%;
                                box-sizing:border-box;
                                margin-top:7px;
                                padding:13px;
                                border:1px solid #ddd;
                                font-size:14px;
                                background:#fff;
                            "
                        >
                            <option value="">
                                Выберите способ доставки
                            </option>

                            <option value="InPost">
                                InPost
                            </option>

                            <option value="Курьер">
                                Курьер
                            </option>

                            <option value="Самовывоз">
                                Самовывоз
                            </option>
                        </select>
                    </label>

                    <label
                        style="
                            display:block;
                            margin-bottom:18px;
                            font-size:13px;
                        "
                    >
                        Адрес доставки

                        <textarea
                            id="checkout-address"
                            rows="4"
                            required
                            style="
                                width:100%;
                                box-sizing:border-box;
                                margin-top:7px;
                                padding:13px;
                                border:1px solid #ddd;
                                font-size:14px;
                                resize:vertical;
                            "
                        ></textarea>
                    </label>

                    <label
                        style="
                            display:block;
                            margin-bottom:25px;
                            font-size:13px;
                        "
                    >
                        Способ оплаты

                        <select
                            id="checkout-payment"
                            required
                            style="
                                width:100%;
                                box-sizing:border-box;
                                margin-top:7px;
                                padding:13px;
                                border:1px solid #ddd;
                                font-size:14px;
                                background:#fff;
                            "
                        >
                            <option value="">
                                Выберите способ оплаты
                            </option>

                            <option value="При получении">
                                При получении
                            </option>

                            <option value="Карта">
                                Банковская карта
                            </option>
                        </select>
                    </label>

                    <div
                        style="
                            display:flex;
                            justify-content:space-between;
                            padding:18px 0;
                            border-top:1px solid #ddd;
                            border-bottom:1px solid #ddd;
                            margin-bottom:20px;
                            font-size:16px;
                        "
                    >

                        <span>
                            Итого
                        </span>

                        <strong>
                            ${total.toFixed(2)} zł
                        </strong>

                    </div>

                    <button
                        type="submit"
                        style="
                            width:100%;
                            padding:16px;
                            border:0;
                            background:#111;
                            color:#fff;
                            font-size:12px;
                            font-weight:bold;
                            cursor:pointer;
                            letter-spacing:1px;
                        "
                    >
                        ПОДТВЕРДИТЬ ЗАКАЗ
                    </button>

                </form>

            </div>
        `;

        document.body.appendChild(
            checkoutWindow
        );

        const closeButton =
            checkoutWindow.querySelector(
                "#checkout-close"
            );

        const checkoutForm =
            checkoutWindow.querySelector(
                "#checkout-form"
            );

        if (
            !closeButton ||
            !checkoutForm
        ) {

            console.error(
                "CHECKOUT: элементы формы не найдены"
            );

            checkoutWindow.remove();

            return;
        }

        closeButton.addEventListener(
            "click",
            () => {

                checkoutWindow.remove();

            }
        );

        checkoutForm.addEventListener(
            "submit",
            async event => {

                event.preventDefault();

                const orderData = {

                    customerName:
                        document
                            .getElementById(
                                "checkout-name"
                            )
                            .value
                            .trim(),

                    phone:
                        document
                            .getElementById(
                                "checkout-phone"
                            )
                            .value
                            .trim(),

                    email:
                        document
                            .getElementById(
                                "checkout-email"
                            )
                            .value
                            .trim(),

                    deliveryMethod:
                        document
                            .getElementById(
                                "checkout-delivery"
                            )
                            .value,

                    deliveryAddress:
                        document
                            .getElementById(
                                "checkout-address"
                            )
                            .value
                            .trim(),

                    paymentMethod:
                        document
                            .getElementById(
                                "checkout-payment"
                            )
                            .value,

                    items:
                        cart
                };

                console.log(
                    "CHECKOUT: отправка заказа",
                    orderData
                );

                try {

                    const response =
                        await fetch(
                            "/api/orders",
                            {
                                method:
                                    "POST",

                                headers: {
                                    "Content-Type":
                                        "application/json"
                                },

                                credentials:
                                    "include",

                                body:
                                    JSON.stringify(
                                        orderData
                                    )
                            }
                        );

                    let data = null;

                    try {

                        data =
                            await response.json();

                    } catch {

                        data = null;
                    }

                    console.log(
                        "ORDER RESPONSE:",
                        data
                    );

                    if (
                        !response.ok ||
                        !data ||
                        !data.success
                    ) {

                        if (
                            response.status === 401
                        ) {

                            alert(
                                "Сначала войдите в аккаунт"
                            );

                        } else {

                            alert(
                                data?.message ||
                                `Не удалось создать заказ: ${response.status}`
                            );
                        }

                        return;
                    }

                    alert(
                        `Заказ №${data.order.id} успешно создан!`
                    );

                    checkoutWindow.remove();

                    cart = [];

                    renderCart();
                    clearLocalCart();
                } catch (error) {

                    console.error(
                        "CREATE ORDER ERROR:",
                        error
                    );

                    alert(
                        "Ошибка соединения с сервером"
                    );
                }
            }
        );
    }
);
/* =====================================================
   FINAL SESSION / CART REFRESH
   ===================================================== */

window.addEventListener(
    "focus",
    () => {

        if (
            typeof loadCart ===
            "function"
        ) {

            loadCart();
        }
    }
);


/* =====================================================
   INITIAL CART LOAD
   ===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        try {

            const response =
                await fetch(
                    "/api/me",
                    {
                        credentials:
                            "include"
                    }
                );

            if (!response.ok) {
                return;
            }

            const data =
                await response.json();

            if (
                data.loggedIn &&
                data.user
            ) {

                await loadCart();

            }

        } catch (error) {

            console.warn(
                "INITIAL SESSION CHECK ERROR:",
                error
            );
        }
    }
);
/* =====================================================
   MAIN NAVIGATION FILTERS
   ===================================================== */

document.addEventListener("click", (event) => {

    const target =
        event.target instanceof Element
            ? event.target
            : null;

    if (!target) {
        return;
    }

    const navLink =
        target.closest(".main-nav a");

    if (!navLink) {
        return;
    }

    const href =
        navLink.getAttribute("href");

    if (!href) {
        return;
    }

    event.preventDefault();

    const section =
        href.replace("#", "")
            .trim()
            .toLowerCase();

    console.log(
        "MAIN NAV:",
        section
    );

    /* =========================
       КАТАЛОГ
    ========================= */

    if (section === "catalog") {

        renderProducts(
            databaseProducts
        );

        document
            .getElementById("catalog")
            ?.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        return;
    }

    /* =========================
       МУЖСКОЕ
    ========================= */

    if (section === "men") {

        const filtered =
            databaseProducts.filter(
                product => {

                    const gender =
                        String(
                            product.gender || ""
                        )
                            .trim()
                            .toLowerCase();

                    return (
                        gender === "male" ||
                        gender === "men" ||
                        gender === "мужское"
                    );
                }
            );

        console.log(
            "MAIN NAV — Мужское:",
            filtered.length
        );

        renderProducts(filtered);

        document
            .getElementById("catalog")
            ?.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        return;
    }

    /* =========================
       ЖЕНСКОЕ
    ========================= */

    if (section === "women") {

        const filtered =
            databaseProducts.filter(
                product => {

                    const gender =
                        String(
                            product.gender || ""
                        )
                            .trim()
                            .toLowerCase();

                    return (
                        gender === "female" ||
                        gender === "women" ||
                        gender === "женское"
                    );
                }
            );

        console.log(
            "MAIN NAV — Женское:",
            filtered.length
        );

        renderProducts(filtered);

        document
            .getElementById("catalog")
            ?.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        return;
    }

    /* =========================
       НОВИНКИ
    ========================= */

    if (section === "new") {

        const filtered =
            databaseProducts.filter(
                product =>
                    product.is_new === true ||
                    product.is_new === "true" ||
                    product.is_new === 1
            );

        console.log(
            "MAIN NAV — Новинки:",
            filtered.length
        );

        renderProducts(filtered);

        document
            .getElementById("catalog")
            ?.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        return;
    }

    /* =========================
       SALE
    ========================= */

    if (section === "sale") {

        const filtered =
            databaseProducts.filter(
                product =>
                    product.is_sale === true ||
                    product.is_sale === "true" ||
                    product.is_sale === 1
            );

        console.log(
            "MAIN NAV — Sale:",
            filtered.length
        );

        renderProducts(filtered);

        document
            .getElementById("catalog")
            ?.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        return;
    }

});
/* =====================================================
   ACCOUNT REGISTRATION FIX
===================================================== */

document.addEventListener("DOMContentLoaded", () => {

    const showRegister =
        document.getElementById("show-register");

    const showLogin =
        document.getElementById("show-login");

    const loginView =
        document.getElementById("login-view");

    const registerView =
        document.getElementById("register-view");

    const registerForm =
        document.getElementById("register-form");

    const registerMessage =
        document.getElementById("register-message");

    if (!showRegister || !registerView) {
        console.error(
            "REGISTER: элементы регистрации не найдены"
        );
        return;
    }

    /* ==========================================
       ОТКРЫТЬ РЕГИСТРАЦИЮ
    ========================================== */

    showRegister.addEventListener(
        "click",
        (event) => {

            event.preventDefault();

            if (loginView) {
                loginView.classList.remove("active");
            }

            registerView.classList.add("active");

            if (registerMessage) {
                registerMessage.textContent = "";
            }
        }
    );

    /* ==========================================
       НАЗАД КО ВХОДУ
    ========================================== */

    if (showLogin) {

        showLogin.addEventListener(
            "click",
            (event) => {

                event.preventDefault();

                registerView.classList.remove(
                    "active"
                );

                if (loginView) {
                    loginView.classList.add(
                        "active"
                    );
                }
            }
        );
    }

    /* ==========================================
       РЕГИСТРАЦИЯ
    ========================================== */

    if (registerForm) {

        registerForm.addEventListener(
            "submit",
            async (event) => {

                event.preventDefault();

                const nameInput =
                    document.getElementById(
                        "register-name"
                    );

                const emailInput =
                    document.getElementById(
                        "register-email"
                    );

                const passwordInput =
                    document.getElementById(
                        "register-password"
                    );

                const name =
                    nameInput
                        ? nameInput.value.trim()
                        : "";

                const email =
                    emailInput
                        ? emailInput.value.trim()
                        : "";

                const password =
                    passwordInput
                        ? passwordInput.value
                        : "";

                if (registerMessage) {
                    registerMessage.textContent =
                        "";
                }

                if (
                    !name ||
                    !email ||
                    !password
                ) {
                    if (registerMessage) {
                        registerMessage.textContent =
                            "Заполните все поля";
                    }

                    return;
                }

                if (password.length < 6) {
                    if (registerMessage) {
                        registerMessage.textContent =
                            "Пароль должен содержать минимум 6 символов";
                    }

                    return;
                }

                try {

                    const response =
                        await fetch(
                            "/api/register",
                            {
                                method: "POST",

                                headers: {
                                    "Content-Type":
                                        "application/json"
                                },

                                credentials: "include",

                                body: JSON.stringify({
                                    name,
                                    email,
                                    password
                                })
                            }
                        );

                    const data =
                        await response.json();

                    if (!response.ok) {

                        if (registerMessage) {
                            registerMessage.textContent =
                                data.message ||
                                "Ошибка регистрации";
                        }

                        return;
                    }

                    if (registerMessage) {
                        registerMessage.textContent =
                            "Регистрация успешна!";
                    }

                    registerForm.reset();

                    setTimeout(() => {

                        registerView.classList.remove(
                            "active"
                        );

                        if (loginView) {
                            loginView.classList.add(
                                "active"
                            );
                        }

                    }, 800);

                    console.log(
                        "REGISTER SUCCESS:",
                        data.user
                    );

                } catch (error) {

                    console.error(
                        "REGISTER ERROR:",
                        error
                    );

                    if (registerMessage) {
                        registerMessage.textContent =
                            "Ошибка соединения с сервером";
                    }
                }
            }
        );
    }

});