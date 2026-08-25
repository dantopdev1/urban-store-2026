const cartButton = document.querySelector(".cart-button");
const cartModal = document.getElementById("cart-modal");
const closeCart = document.getElementById("close-cart");
const cartCount = document.getElementById("cart-count");
const cartItems = document.getElementById("cart-items");
const cartTotal = document.getElementById("cart-total");
const clearCart = document.getElementById("clear-cart");

let cart = [];
let databaseProducts = [];


/* =====================================================
   КОРЗИНА
===================================================== */

function renderCart() {

    const count =
        cart.reduce(
            (sum, item) =>
                sum + item.quantity,
            0
        );


    if (cartCount) {

        cartCount.textContent =
            count;

    }


    if (!cartItems) {
        return;
    }


    cartItems.innerHTML = "";


    if (!cart.length) {

        cartItems.innerHTML = `
            <p
                style="
                    color:#777;
                    padding:25px 0;
                "
            >
                Корзина пуста.
            </p>
        `;

        if (cartTotal) {
            cartTotal.textContent = "0.00";
        }

        return;
    }


    let total = 0;


    cart.forEach((item) => {

        const itemPrice =
            Number(item.price) || 0;


        total +=
            itemPrice *
            item.quantity;


        const row =
            document.createElement("div");


        row.className =
            "cart-item";


        row.innerHTML = `
            <span>
                ${item.name} × ${item.quantity}
            </span>

            <strong>
                ${
                    (
                        itemPrice *
                        item.quantity
                    ).toFixed(2)
                } zł
            </strong>
        `;


        cartItems.appendChild(row);

    });


    if (cartTotal) {

        cartTotal.textContent =
            total.toFixed(2);

    }

}


/* =====================================================
   ДОБАВЛЕНИЕ В КОРЗИНУ
===================================================== */

function addToCart(product) {

    if (!product) {
        return;
    }


    const existing =
        cart.find(
            (item) =>
                item.id === product.id
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
   ТОВАРЫ ИЗ POSTGRESQL
===================================================== */

async function loadProducts() {

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


        console.log(
            "Товары из PostgreSQL:",
            products
        );


        if (!Array.isArray(products)) {

            throw new Error(
                "Сервер вернул неправильный формат товаров"
            );

        }


        databaseProducts =
            products;


        renderProducts(
            products
        );


    } catch (error) {

        console.error(
            "Ошибка загрузки товаров:",
            error
        );

    }

}


/* =====================================================
   ОТОБРАЖЕНИЕ ТОВАРОВ
===================================================== */

function renderProducts(products) {

    const container =
        document.querySelector("#products-grid") ||
        document.querySelector(".products-grid");


    if (!container) {

        console.error(
            "Не найден #products-grid"
        );

        return;
    }


    container.innerHTML = "";


    if (
        !products ||
        !products.length
    ) {

        container.innerHTML = `
            <div
                style="
                    grid-column:1/-1;
                    padding:80px 20px;
                    text-align:center;
                "
            >

                <h3>
                    Товаров пока нет
                </h3>

            </div>
        `;

        return;
    }


    products.forEach(
        (product, index) => {

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "product";


            card.dataset.category =
                product.category ||
                "all";


            const image =
                product.image
                    ? product.image
                    : "images/placeholder.jpg";


            const price =
                Number(product.price) || 0;


            const stock =
                Number(product.stock) || 0;


            const outOfStock =
                stock <= 0;


            card.innerHTML = `

                <div class="product-image-wrapper">

                    <img
                        src="${image}"
                        alt="${product.name || "URBAN product"}"
                        class="product-image"
                    >

                </div>


                <div class="product-info">

                    <h3>
                        ${product.name || "Без названия"}
                    </h3>


                    <p>
                        ${product.description || ""}
                    </p>


                    <div class="product-bottom">

                        <span
                            class="product-price"
                        >
                            ${price.toFixed(2)} zł
                        </span>


                        ${
                            outOfStock

                                ?

                                `
                                    <button
                                        class="add-to-cart"
                                        disabled
                                    >
                                        Нет в наличии
                                    </button>
                                `

                                :

                                `
                                    <button
                                        class="add-to-cart"
                                        type="button"
                                    >
                                        Добавить
                                    </button>
                                `
                        }

                    </div>

                </div>

            `;


            const productImage =
                card.querySelector(
                    ".product-image"
                );


            if (productImage) {

                productImage.addEventListener(
                    "error",
                    function () {

                        productImage.src =
                            "images/placeholder.jpg";

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
                    function () {

                        addToCart(
                            product
                        );


                        const oldText =
                            button.textContent;


                        button.textContent =
                            "Добавлено ✓";


                        setTimeout(
                            function () {

                                button.textContent =
                                    oldText;

                            },
                            700
                        );

                    }
                );

            }


            card.style.animationDelay =
                `${index * 0.05}s`;


            container.appendChild(
                card
            );

        }
    );

}


/* =====================================================
   ФИЛЬТРЫ
===================================================== */

function setupFilters() {

    const categoryButtons =
        document.querySelectorAll(
            ".category-btn"
        );


    categoryButtons.forEach(
        (button) => {

            button.addEventListener(
                "click",
                () => {

                    const category =
                        button.dataset.category;


                    categoryButtons.forEach(
                        (item) => {

                            item.classList.remove(
                                "active"
                            );

                        }
                    );


                    button.classList.add(
                        "active"
                    );


                    const filteredProducts =
                        category === "all"

                            ?

                            databaseProducts

                            :

                            databaseProducts.filter(
                                (product) =>
                                    product.category ===
                                    category
                            );


                    renderProducts(
                        filteredProducts
                    );

                }
            );

        }
    );

}


/* =====================================================
   КОРЗИНА — ОТКРЫТИЕ
===================================================== */

if (
    cartButton &&
    cartModal
) {

    cartButton.addEventListener(
        "click",
        () => {

            cartModal.classList.add(
                "open"
            );

        }
    );

}


/* =====================================================
   КОРЗИНА — ЗАКРЫТИЕ
===================================================== */

if (
    closeCart &&
    cartModal
) {

    closeCart.addEventListener(
        "click",
        () => {

            cartModal.classList.remove(
                "open"
            );

        }
    );

}


/* =====================================================
   КОРЗИНА — ОЧИСТКА
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
   NEWSLETTER
===================================================== */

const newsletterForm =
    document.getElementById(
        "newsletter-form"
    );


if (newsletterForm) {

    newsletterForm.addEventListener(
        "submit",
        (event) => {

            event.preventDefault();


            const button =
                event.target.querySelector(
                    "button"
                );


            if (button) {

                const oldText =
                    button.textContent;


                button.textContent =
                    "Готово ✓";


                setTimeout(
                    () => {

                        button.textContent =
                            oldText;

                    },
                    1500
                );

            }

        }
    );

}


/* =====================================================
   ACCOUNT
===================================================== */

const accountButton =
    document.getElementById(
        "account-button"
    );


const accountPanel =
    document.getElementById(
        "account-panel"
    );


const accountOverlay =
    document.getElementById(
        "account-overlay"
    );


const accountClose =
    document.getElementById(
        "account-close"
    );


const loginView =
    document.getElementById(
        "login-view"
    );


const registerView =
    document.getElementById(
        "register-view"
    );


const userView =
    document.getElementById(
        "user-view"
    );


const showRegister =
    document.getElementById(
        "show-register"
    );


const showLogin =
    document.getElementById(
        "show-login"
    );


const loginForm =
    document.getElementById(
        "login-form"
    );


const registerForm =
    document.getElementById(
        "register-form"
    );


const logoutButton =
    document.getElementById(
        "logout-button"
    );


const loginMessage =
    document.getElementById(
        "login-message"
    );


const registerMessage =
    document.getElementById(
        "register-message"
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
   ACCOUNT — OPEN
===================================================== */

function openAccount() {

    if (accountPanel) {

        accountPanel.classList.add(
            "open"
        );

    }


    if (accountOverlay) {

        accountOverlay.classList.add(
            "open"
        );

    }

}


/* =====================================================
   ACCOUNT — CLOSE
===================================================== */

function closeAccount() {

    if (accountPanel) {

        accountPanel.classList.remove(
            "open"
        );

    }


    if (accountOverlay) {

        accountOverlay.classList.remove(
            "open"
        );

    }

}


/* =====================================================
   SHOW LOGIN
===================================================== */

function showLoginView() {

    if (loginView) {

        loginView.classList.add(
            "active"
        );

    }


    if (registerView) {

        registerView.classList.remove(
            "active"
        );

    }


    if (userView) {

        userView.classList.remove(
            "active"
        );

    }

}


/* =====================================================
   SHOW REGISTER
===================================================== */

function showRegisterView() {

    if (loginView) {

        loginView.classList.remove(
            "active"
        );

    }


    if (registerView) {

        registerView.classList.add(
            "active"
        );

    }


    if (userView) {

        userView.classList.remove(
            "active"
        );

    }

}


/* =====================================================
   SHOW USER
===================================================== */

function showUserView(user) {

    if (loginView) {

        loginView.classList.remove(
            "active"
        );

    }


    if (registerView) {

        registerView.classList.remove(
            "active"
        );

    }


    if (userView) {

        userView.classList.add(
            "active"
        );

    }


    if (userName) {

        userName.textContent =
            user.name ||
            "Пользователь";

    }


    if (userEmail) {

        userEmail.textContent =
            user.email ||
            "";

    }


    if (accountButton) {

        accountButton.textContent =
            user.name ||
            "ACCOUNT";

    }

}


/* =====================================================
   ACCOUNT BUTTON
===================================================== */

if (accountButton) {

    accountButton.addEventListener(
        "click",
        async () => {

            openAccount();


            try {

                const response =
                    await fetch(
                        "/api/me"
                    );


                const data =
                    await response.json();


                if (
                    data.loggedIn &&
                    data.user
                ) {

                    showUserView(
                        data.user
                    );

                } else {

                    showLoginView();

                }


            } catch (error) {

                console.error(
                    "ACCOUNT ERROR:",
                    error
                );


                showLoginView();

            }

        }
    );

}


/* =====================================================
   ACCOUNT CLOSE
===================================================== */

if (accountClose) {

    accountClose.addEventListener(
        "click",
        closeAccount
    );

}


if (accountOverlay) {

    accountOverlay.addEventListener(
        "click",
        closeAccount
    );

}


/* =====================================================
   CREATE ACCOUNT
===================================================== */

if (showRegister) {

    showRegister.addEventListener(
        "click",
        (event) => {

            event.preventDefault();

            event.stopPropagation();

            showRegisterView();

        }
    );

}


/* =====================================================
   BACK TO LOGIN
===================================================== */

if (showLogin) {

    showLogin.addEventListener(
        "click",
        (event) => {

            event.preventDefault();

            event.stopPropagation();

            showLoginView();

        }
    );

}


/* =====================================================
   LOGIN
===================================================== */

if (loginForm) {

    loginForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


            const emailInput =
                document.getElementById(
                    "login-email"
                );


            const passwordInput =
                document.getElementById(
                    "login-password"
                );


            if (
                !emailInput ||
                !passwordInput
            ) {

                return;

            }


            const email =
                emailInput.value
                    .trim();


            const password =
                passwordInput.value;


            if (loginMessage) {

                loginMessage.textContent =
                    "Выполняется вход...";

            }


            try {

                const response =
                    await fetch(
                        "/api/login",
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body:
                                JSON.stringify({
                                    email,
                                    password
                                })
                        }
                    );


                const data =
                    await response.json();


                if (!response.ok) {

                    throw new Error(
                        data.message ||
                        "Ошибка входа"
                    );

                }


                loginForm.reset();


                if (loginMessage) {

                    loginMessage.textContent =
                        "";

                }


                showUserView(
                    data.user
                );


            } catch (error) {

                console.error(
                    "LOGIN ERROR:",
                    error
                );


                if (loginMessage) {

                    loginMessage.textContent =
                        error.message;

                }

            }

        }
    );

}


/* =====================================================
   REGISTRATION
===================================================== */

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


            if (
                !nameInput ||
                !emailInput ||
                !passwordInput
            ) {

                return;

            }


            const name =
                nameInput.value
                    .trim();


            const email =
                emailInput.value
                    .trim();


            const password =
                passwordInput.value;


            if (registerMessage) {

                registerMessage.textContent =
                    "Создание аккаунта...";

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

                            body:
                                JSON.stringify({
                                    name,
                                    email,
                                    password
                                })
                        }
                    );


                const data =
                    await response.json();


                if (!response.ok) {

                    throw new Error(
                        data.message ||
                        "Ошибка регистрации"
                    );

                }


                registerForm.reset();


                if (registerMessage) {

                    registerMessage.textContent =
                        "";

                }


                showUserView(
                    data.user
                );


            } catch (error) {

                console.error(
                    "REGISTER ERROR:",
                    error
                );


                if (registerMessage) {

                    registerMessage.textContent =
                        error.message;

                }

            }

        }
    );

}


/* =====================================================
   LOGOUT
===================================================== */

if (logoutButton) {

    logoutButton.addEventListener(
        "click",
        async () => {

            try {

                await fetch(
                    "/api/logout",
                    {
                        method: "POST"
                    }
                );


            } catch (error) {

                console.error(
                    "LOGOUT ERROR:",
                    error
                );

            }


            if (accountButton) {

                accountButton.textContent =
                    "ACCOUNT";

            }


            showLoginView();

            closeAccount();

        }
    );

}


/* =====================================================
   ESCAPE
===================================================== */

document.addEventListener(
    "keydown",
    (event) => {

        if (
            event.key === "Escape"
        ) {

            closeAccount();

        }

    }
);


/* =====================================================
   ЗАПУСК
===================================================== */

loadProducts();

setupFilters();

renderCart();
/* =====================================================
   URBAN — DATABASE CART SYNC
===================================================== */

let urbanCurrentUser = null;


/* =====================================================
   CHECK CURRENT USER
===================================================== */

async function urbanCheckUser() {

    try {

        const response =
            await fetch("/api/me");

        const data =
            await response.json();

        if (
            data.loggedIn &&
            data.user
        ) {

            urbanCurrentUser =
                data.user;

            await urbanLoadCart();

            return true;

        }

        urbanCurrentUser =
            null;

        return false;

    } catch (error) {

        console.error(
            "Ошибка проверки аккаунта:",
            error
        );

        urbanCurrentUser =
            null;

        return false;

    }

}


/* =====================================================
   LOAD CART FROM POSTGRESQL
===================================================== */

async function urbanLoadCart() {

    if (!urbanCurrentUser) {
        return;
    }


    try {

        const response =
            await fetch("/api/cart");


        if (
            response.status === 401
        ) {

            urbanCurrentUser =
                null;

            return;

        }


        const data =
            await response.json();


        if (
            !response.ok ||
            !data.success
        ) {

            throw new Error(
                data.message ||
                "Ошибка загрузки корзины"
            );

        }


        cart =
            (data.cart || []).map(
                item => ({

                    id:
                        item.product_id,

                    product_id:
                        item.product_id,

                    name:
                        item.name,

                    description:
                        item.description,

                    price:
                        Number(item.price) || 0,

                    image:
                        item.image,

                    stock:
                        Number(item.stock) || 0,

                    category:
                        item.category,

                    quantity:
                        Number(item.quantity) || 1

                })
            );


        renderCart();


    } catch (error) {

        console.error(
            "Ошибка загрузки корзины:",
            error
        );

    }

}


/* =====================================================
   SAVE PRODUCT TO POSTGRESQL
===================================================== */

async function urbanSaveCartProduct(
    product
) {

    if (!urbanCurrentUser) {

        openAccount();

        showLoginView();

        return false;

    }


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

                    body:
                        JSON.stringify({

                            productId:
                                product.id,

                            quantity:
                                1

                        })

                }
            );


        const data =
            await response.json();


        if (
            response.status === 401
        ) {

            urbanCurrentUser =
                null;

            openAccount();

            showLoginView();

            return false;

        }


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Не удалось сохранить товар"
            );

        }


        await urbanLoadCart();

        return true;


    } catch (error) {

        console.error(
            "Ошибка сохранения корзины:",
            error
        );


        alert(
            error.message
        );


        return false;

    }

}


/* =====================================================
   WRAP EXISTING ADD TO CART
===================================================== */

if (
    typeof addToCart === "function"
) {

    const urbanOriginalAddToCart =
        addToCart;


    addToCart =
        async function(product) {

            if (!urbanCurrentUser) {

                openAccount();

                showLoginView();

                return;

            }


            try {

                const saved =
                    await urbanSaveCartProduct(
                        product
                    );


                if (!saved) {
                    return;
                }


                /*
                    Корзина уже обновлена
                    с сервера через urbanLoadCart().
                */

            } catch (error) {

                console.error(
                    error
                );

                /*
                    На случай ошибки
                    оставляем старое поведение.
                */

                urbanOriginalAddToCart(
                    product
                );

            }

        };

}


/* =====================================================
   CLEAR CART FROM DATABASE
===================================================== */

if (clearCart) {

    clearCart.addEventListener(
        "click",
        async function () {

            if (!urbanCurrentUser) {
                return;
            }


            try {

                const response =
                    await fetch(
                        "/api/cart",
                        {
                            method: "DELETE"
                        }
                    );


                const data =
                    await response.json();


                if (!response.ok) {

                    throw new Error(
                        data.message ||
                        "Ошибка очистки корзины"
                    );

                }


                cart = [];


                renderCart();


            } catch (error) {

                console.error(
                    "Ошибка очистки корзины:",
                    error
                );

            }

        }
    );

}


/* =====================================================
   WRAP USER LOGIN / REGISTER
===================================================== */

if (
    typeof showUserView === "function"
) {

    const urbanOriginalShowUserView =
        showUserView;


    showUserView =
        function(user) {

            urbanCurrentUser =
                user;


            urbanOriginalShowUserView(
                user
            );


            setTimeout(
                () => {

                    urbanLoadCart();

                },
                0
            );

        };

}


/* =====================================================
   WRAP LOGOUT
===================================================== */

if (logoutButton) {

    logoutButton.addEventListener(
        "click",
        function () {

            urbanCurrentUser =
                null;

            cart = [];

            renderCart();

        }
    );

}


/* =====================================================
   LOAD ACCOUNT + CART
===================================================== */

urbanCheckUser();