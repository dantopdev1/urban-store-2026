/* =====================================================
   URBAN STORE
   PostgreSQL + Catalog + Filters + Cart + Quick View
   ===================================================== */

let cart = [];
let databaseProducts = [];

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

            const parsed = JSON.parse(product.images);

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

        const images = getProductImages(product);

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
                        Number(button.dataset.index);

                    cart.splice(index, 1);

                    renderCart();

                }
            );

        });

}


/* =====================================================
   ADD TO CART
   ===================================================== */

function addToCart(product) {

    const existing =
        cart.find(
            item =>
                String(item.id) ===
                String(product.id)
        );

    if (existing) {

        existing.quantity++;

    } else {

        cart.push({

            id: product.id,

            name: product.name,

            price:
                Number(product.price) || 0,

            quantity: 1

        });

    }

    renderCart();
}


/* =====================================================
   QUICK VIEW GALLERY
   ===================================================== */

function createQuickViewGallery() {

    const imageContainer =
        document.querySelector(".quick-view-image");

    if (!imageContainer) {
        return;
    }

    let thumbnails =
        imageContainer.querySelector(
            ".quick-view-thumbnails"
        );

    if (!thumbnails) {

        thumbnails =
            document.createElement("div");

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
                document.createElement("button");

            thumbnail.type = "button";

            thumbnail.className =
                "quick-view-thumbnail";

            if (
                index ===
                currentQuickViewImageIndex
            ) {

                thumbnail.classList.add("active");

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

                    showQuickViewImage(index);

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
        index >= currentQuickViewImages.length
    ) {
        return;
    }

    currentQuickViewImageIndex =
        index;

    quickViewImage.src =
        currentQuickViewImages[index];

    document
        .querySelectorAll(".quick-view-thumbnail")
        .forEach(
            (thumbnail, thumbnailIndex) => {

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

    currentQuickViewImageIndex = 0;

    if (quickViewName) {

        quickViewName.textContent =
            product.name || "URBAN";

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
            Number(product.price) || 0;

        quickViewPrice.textContent =
            `${price.toFixed(2)} zł`;

    }

    const stock =
        Number(product.stock) || 0;

    if (quickViewStock) {
        quickViewStock.textContent = stock;
        /* =====================================================
   SIZE SELECTOR
===================================================== */

const sizes = Array.isArray(product.sizes)
    ? product.sizes
    : ["S", "M", "L", "XL"];

let quickViewSizes = document.querySelector(
    ".quick-view-sizes"
);

if (!quickViewSizes) {
    quickViewSizes = document.createElement("div");
    quickViewSizes.className = "quick-view-sizes";

    const quickViewBottom =
        document.querySelector(".quick-view-bottom");

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
        ${sizes.map((size, index) => `
            <button
                type="button"
                class="quick-view-size ${index === 0 ? "active" : ""}"
                data-size="${escapeHTML(size)}"
            >
                ${escapeHTML(size)}
            </button>
        `).join("")}
    </div>
`;

quickViewSizes
    .querySelectorAll(".quick-view-size")
    .forEach(button => {
        button.addEventListener("click", () => {
            quickViewSizes
                .querySelectorAll(".quick-view-size")
                .forEach(item => {
                    item.classList.remove("active");
                });

            button.classList.add("active");
        });
    });
    }

    if (quickViewImage) {

        quickViewImage.src =
            currentQuickViewImages[0];

        quickViewImage.alt =
            product.name || "URBAN";

        quickViewImage.onerror =
            function () {

                this.onerror = null;

                this.src =
                    "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=1200&q=90";

            };
    }

    createQuickViewGallery();

    if (quickViewAdd) {

        if (stock <= 0) {

            quickViewAdd.disabled = true;

            quickViewAdd.textContent =
                "НЕТ В НАЛИЧИИ";

        } else {

            quickViewAdd.disabled = false;

            quickViewAdd.textContent =
                "ДОБАВИТЬ В КОРЗИНУ";

        }
    }

    quickViewOverlay.classList.add("open");

    document.body.classList.add("no-scroll");
}


/* =====================================================
   CLOSE QUICK VIEW
   ===================================================== */

function closeQuickView() {

    if (!quickViewOverlay) {
        return;
    }

    quickViewOverlay.classList.remove("open");

    document.body.classList.remove("no-scroll");

    currentQuickViewProduct = null;
}


/* =====================================================
   CREATE PRODUCT CARD
   ===================================================== */

function createProductCard(product, index) {

    const card =
        document.createElement("article");

    card.className = "product";

    card.dataset.category =
        product.category || "all";

    card.style.animationDelay =
        `${index * 0.04}s`;

    const images =
        getProductImages(product);

    const price =
        Number(product.price) || 0;

    const stock =
        Number(product.stock) || 0;

    const outOfStock =
        stock <= 0;

    card.innerHTML = `

        <div class="product-image-wrapper">

            <img
                src="${escapeHTML(images[0])}"
                alt="${escapeHTML(
                    product.name || "URBAN"
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
                            ${escapeHTML(product.badge)}
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
                        product.name || "URBAN"
                    )}
                </h3>

            </div>

            <p>
                ${escapeHTML(
                    product.description || ""
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
        card.querySelector(".product-image");

    if (image) {

        image.addEventListener(
            "error",
            function () {

                this.onerror = null;

                this.src =
                    "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=1200&q=90";

            }
        );

    }

    const quickButton =
        card.querySelector(".quick-view-button");

    if (quickButton) {

        quickButton.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                openQuickView(product);

            }
        );

    }

    const button =
        card.querySelector(".add-to-cart");

    if (
        button &&
        !outOfStock
    ) {

        button.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                addToCart(product);

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
        card.querySelector(".product-favorite");

    if (favorite) {

        favorite.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                favorite.classList.toggle("active");

                favorite.textContent =
                    favorite.classList.contains("active")
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

function renderProducts(products) {

    const container =
        document.querySelector("#products-grid");

    if (!container) {

        console.error(
            "#products-grid не найден"
        );

        return;
    }

    container.innerHTML = "";

    const uniqueProducts =
        removeDuplicateProducts(products);

    if (uniqueProducts.length === 0) {

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
        (product, index) => {

            const card =
                createProductCard(
                    product,
                    index
                );

            container.appendChild(card);

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
            await fetch("/products");

        if (!response.ok) {

            throw new Error(
                `Ошибка сервера: ${response.status}`
            );

        }

        const products =
            await response.json();

        if (!Array.isArray(products)) {

            throw new Error(
                "Сервер вернул неправильный формат товаров"
            );

        }

        databaseProducts =
            removeDuplicateProducts(products);

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
   ⭐ NEW FILTER SYSTEM
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

    buttons.forEach(button => {

        button.addEventListener(
            "click",
            () => {

                /* -------------------------------------
                   Определяем кнопку
                   ------------------------------------- */

                const text =
                    button.textContent
                        .trim()
                        .toLowerCase();

                const dataCategory =
                    String(
                        button.dataset.category || ""
                    )
                    .trim()
                    .toLowerCase();

                console.log(
                    "Нажата кнопка:",
                    text,
                    dataCategory
                );


                /* -------------------------------------
                   ACTIVE
                   ------------------------------------- */

                buttons.forEach(item => {

                    item.classList.remove(
                        "active"
                    );

                });

                button.classList.add("active");


                /* -------------------------------------
                   КАТАЛОГ / ВСЕ
                   ------------------------------------- */

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


                /* -------------------------------------
                   МУЖСКОЕ
                   PostgreSQL: gender = male
                   ------------------------------------- */

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
                                        product.gender || ""
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

                    console.log(
                        "Мужские товары:",
                        filtered.length
                    );

                    renderProducts(filtered);

                    return;
                }


                /* -------------------------------------
                   ЖЕНСКОЕ
                   PostgreSQL: gender = female
                   ------------------------------------- */

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
                                        product.gender || ""
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

                    console.log(
                        "Женские товары:",
                        filtered.length
                    );

                    renderProducts(filtered);

                    return;
                }


                /* -------------------------------------
                   НОВИНКИ
                   PostgreSQL: is_new = true
                   ------------------------------------- */

                if (
                    text === "новинки" ||
                    text === "новинки"
                ) {

                    const filtered =
                        databaseProducts.filter(
                            product =>
                                product.is_new === true ||
                                product.is_new === "true" ||
                                product.is_new === 1
                        );

                    console.log(
                        "Новинки:",
                        filtered.length
                    );

                    renderProducts(filtered);

                    return;
                }


                /* -------------------------------------
                   SALE
                   PostgreSQL: is_sale = true
                   ------------------------------------- */

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

                    console.log(
                        "SALE:",
                        filtered.length
                    );

                    renderProducts(filtered);

                    return;
                }


                /* -------------------------------------
                   ОБЫЧНЫЕ КАТЕГОРИИ
                   hoodies / tshirts / pants / jackets
                   ------------------------------------- */

                const filtered =
                    databaseProducts.filter(
                        product => {

                            const category =
                                String(
                                    product.category || ""
                                )
                                .trim()
                                .toLowerCase();

                            return (
                                category === dataCategory ||
                                category === text
                            );

                        }
                    );

                console.log(
                    "Категория:",
                    dataCategory,
                    "Товаров:",
                    filtered.length
                );

                renderProducts(filtered);

            }
        );

    });

}


/* =====================================================
   CART OPEN
   ===================================================== */

if (cartButton) {

    cartButton.addEventListener(
        "click",
        () => {

            if (cartModal) {
                cartModal.classList.add("open");
            }

            if (cartOverlay) {
                cartOverlay.classList.add("open");
            }

        }
    );

}


/* =====================================================
   CART CLOSE
   ===================================================== */

function closeCartModal() {

    if (cartModal) {
        cartModal.classList.remove("open");
    }

    if (cartOverlay) {
        cartOverlay.classList.remove("open");
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
        () => {

            cart = [];

            renderCart();

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
   QUICK VIEW ADD TO CART
   ===================================================== */

if (quickViewAdd) {

    quickViewAdd.addEventListener(
        "click",
        () => {

            if (!currentQuickViewProduct) {
                return;
            }

            const stock =
                Number(
                    currentQuickViewProduct.stock
                ) || 0;

            if (stock <= 0) {
                return;
            }

            addToCart(
                currentQuickViewProduct
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
   SEARCH OPEN
   ===================================================== */

if (searchButton) {

    searchButton.addEventListener(
        "click",
        () => {

            if (searchPanel) {

                searchPanel.classList.toggle("open");

                if (
                    searchPanel.classList.contains("open")
                ) {

                    if (searchInput) {
                        searchInput.focus();
                    }

                }

            }

        }
    );

}


/* =====================================================
   SEARCH CLOSE
   ===================================================== */

if (closeSearch) {

    closeSearch.addEventListener(
        "click",
        () => {

            if (searchPanel) {

                searchPanel.classList.remove("open");

            }

        }
    );

}


/* =====================================================
   SEARCH PRODUCTS
   ===================================================== */

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
                                product.name || ""
                            )
                            .toLowerCase();

                        const description =
                            String(
                                product.description || ""
                            )
                            .toLowerCase();

                        return (
                            name.includes(query) ||
                            description.includes(query)
                        );

                    }
                );

            renderProducts(filtered);

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
                newsletterForm.querySelector("button");

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

        if (event.key === "Escape") {

            closeQuickView();

            closeCartModal();

            if (searchPanel) {

                searchPanel.classList.remove("open");

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

        renderCart();

        loadProducts();

        console.log(
            "URBAN STORE запущен ✓"
        );

    }
);