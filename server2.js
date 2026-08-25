require("dotenv").config();

const express = require("express");
const { Pool } = require("pg");
const crypto = require("crypto");

const app = express();
const PORT = 3000;


/* =====================================================
   MIDDLEWARE
===================================================== */

app.use(express.json());
app.use(express.static(__dirname));
function requireAdmin(req, res, next) {
    next();
}
app.get("/admin", (req, res) => {
    res.sendFile(__dirname + "/admin.html/admin.html");
});

/* =====================================================
   POSTGRESQL
===================================================== */

const pool = new Pool(
    process.env.DATABASE_URL
        ? {
            connectionString:
                process.env.DATABASE_URL
        }
        : {
            user:
                process.env.DB_USER,

            host:
                process.env.DB_HOST,

            database:
                process.env.DB_NAME,

            password:
                process.env.DB_PASSWORD,

            port:
                Number(process.env.DB_PORT) || 5432
        }
);


/* =====================================================
   SESSIONS
===================================================== */

const sessions = new Map();


/* =====================================================
   PASSWORD HASH
===================================================== */

function hashPassword(password) {

    const salt =
        crypto
            .randomBytes(16)
            .toString("hex");

    const hash =
        crypto
            .scryptSync(
                password,
                salt,
                64
            )
            .toString("hex");

    return `${salt}:${hash}`;
}


/* =====================================================
   PASSWORD VERIFY
===================================================== */

function verifyPassword(
    password,
    storedPassword
) {

    try {

        const parts =
            storedPassword.split(":");

        if (parts.length !== 2) {
            return false;
        }

        const salt =
            parts[0];

        const originalHash =
            parts[1];

        const hash =
            crypto
                .scryptSync(
                    password,
                    salt,
                    64
                )
                .toString("hex");

        return crypto.timingSafeEqual(
            Buffer.from(hash, "hex"),
            Buffer.from(originalHash, "hex")
        );

    } catch (error) {

        console.error(
            "Ошибка проверки пароля:",
            error
        );

        return false;
    }
}


/* =====================================================
   CREATE SESSION
===================================================== */

function createSession(user) {

    const token =
        crypto
            .randomBytes(32)
            .toString("hex");

    sessions.set(
        token,
        {
            id:
                user.id,

            name:
                user.name,

            email:
                user.email
        }
    );

    return token;
}


/* =====================================================
   GET SESSION
===================================================== */

function getSession(req) {

    const cookieHeader =
        req.headers.cookie || "";

    const match =
        cookieHeader.match(
            /urban_session=([^;]+)/
        );

    if (!match) {
        return null;
    }

    return (
        sessions.get(
            match[1]
        ) || null
    );
}


/* =====================================================
   SET COOKIE
===================================================== */

function setSessionCookie(
    res,
    token
) {

    res.setHeader(
        "Set-Cookie",
        `urban_session=${token}; HttpOnly; Path=/; SameSite=Lax`
    );
}


/* =====================================================
   CLEAR COOKIE
===================================================== */

function clearSessionCookie(res) {

    res.setHeader(
        "Set-Cookie",
        "urban_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax"
    );
}


/* =====================================================
   AUTH MIDDLEWARE
===================================================== */

function requireAuth(
    req,
    res,
    next
) {

    const user =
        getSession(req);

    if (!user) {

        return res.status(401).json({

            success: false,

            message:
                "Необходимо войти в аккаунт"

        });
    }

    req.user =
        user;

    next();
}/* =====================================================
   ADMIN MIDDLEWARE
===================================================== */

const ADMIN_EMAIL =
    "admin@urban.pl";


function requireAdmin(
    req,
    res,
    next
) {

    const user =
        getSession(req);

    if (!user) {

        return res.status(401).json({

            success: false,

            message:
                "Необходимо войти в аккаунт"

        });
    }

    if (
        String(user.email).toLowerCase() !==
        ADMIN_EMAIL.toLowerCase()
    ) {

        return res.status(403).json({

            success: false,

            message:
                "Доступ запрещён"

        });
    }

    req.user =
        user;

    next();
}


/* =====================================================
   DATABASE TEST
===================================================== */

app.get(
    "/test-db",
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    "SELECT NOW()"
                );

            res.json({

                success: true,

                message:
                    "PostgreSQL подключен",

                time:
                    result.rows[0].now

            });

        } catch (error) {

            console.error(
                "DATABASE TEST ERROR:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Ошибка подключения к PostgreSQL"

            });
        }
    }
);


/* =====================================================
   PRODUCTS
===================================================== */

app.get(
    "/products",
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT
                        id,
                        name,
                        description,
                        price,
                        image,
                        stock,
                        created_at,
                        category
                    FROM products
                    ORDER BY id ASC
                    `
                );

            res.json(
                result.rows
            );

        } catch (error) {

            console.error(
                "PRODUCTS ERROR:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Ошибка получения товаров"

            });
        }
    }
);


/* =====================================================
   REGISTER
===================================================== */

app.post(
    "/api/register",
    async (req, res) => {

        try {

            const {
                name,
                email,
                password
            } = req.body;

            if (
                !name ||
                !email ||
                !password
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Заполни все поля"

                });
            }

            const cleanName =
                String(name).trim();

            const cleanEmail =
                String(email)
                    .trim()
                    .toLowerCase();

            const cleanPassword =
                String(password);

            if (
                cleanName.length < 2
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Имя должно содержать минимум 2 символа"

                });
            }

            if (
                !cleanEmail.includes("@")
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Введите корректный email"

                });
            }

            if (
                cleanPassword.length < 6
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Пароль должен содержать минимум 6 символов"

                });
            }

            const existing =
                await pool.query(
                    `
                    SELECT id
                    FROM users
                    WHERE email = $1
                    LIMIT 1
                    `,
                    [
                        cleanEmail
                    ]
                );

            if (
                existing.rows.length > 0
            ) {

                return res.status(409).json({

                    success: false,

                    message:
                        "Пользователь с таким email уже существует"

                });
            }

            const passwordHash =
                hashPassword(
                    cleanPassword
                );

            const result =
                await pool.query(
                    `
                    INSERT INTO users
                    (
                        name,
                        email,
                        password_hash
                    )
                    VALUES
                    (
                        $1,
                        $2,
                        $3
                    )
                    RETURNING
                        id,
                        name,
                        email,
                        created_at
                    `,
                    [
                        cleanName,
                        cleanEmail,
                        passwordHash
                    ]
                );

            const user =
                result.rows[0];

            const token =
                createSession(
                    user
                );

            setSessionCookie(
                res,
                token
            );

            res.status(201).json({

                success: true,

                message:
                    "Регистрация успешна",

                user

            });

        } catch (error) {

            console.error(
                "REGISTER ERROR:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Ошибка регистрации"

            });
        }
    }
);


/* =====================================================
   LOGIN
===================================================== */

app.post(
    "/api/login",
    async (req, res) => {

        try {

            const {
                email,
                password
            } = req.body;

            if (
                !email ||
                !password
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Введите email и пароль"

                });
            }

            const cleanEmail =
                String(email)
                    .trim()
                    .toLowerCase();

            const result =
                await pool.query(
                    `
                    SELECT
                        id,
                        name,
                        email,
                        password_hash,
                        created_at
                    FROM users
                    WHERE email = $1
                    LIMIT 1
                    `,
                    [
                        cleanEmail
                    ]
                );

            if (
                result.rows.length === 0
            ) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Неверный email или пароль"

                });
            }

            const user =
                result.rows[0];

            const correct =
                verifyPassword(
                    String(password),
                    user.password_hash
                );

            if (!correct) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Неверный email или пароль"

                });
            }

            const token =
                createSession(
                    user
                );

            setSessionCookie(
                res,
                token
            );

            res.json({

                success: true,

                message:
                    "Вход выполнен",

                user: {

                    id:
                        user.id,

                    name:
                        user.name,

                    email:
                        user.email,

                    created_at:
                        user.created_at

                }

            });

        } catch (error) {

            console.error(
                "LOGIN ERROR:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Ошибка входа"

            });
        }
    }
);/* =====================================================
   CURRENT USER
===================================================== */

app.get(
    "/api/me",
    (req, res) => {

        const user =
            getSession(req);

        if (!user) {

            return res.json({

                loggedIn: false

            });
        }

        res.json({

            loggedIn: true,

            user

        });
    }
);


/* =====================================================
   LOGOUT
===================================================== */

app.post(
    "/api/logout",
    (req, res) => {

        const cookieHeader =
            req.headers.cookie || "";

        const match =
            cookieHeader.match(
                /urban_session=([^;]+)/
            );

        if (match) {

            sessions.delete(
                match[1]
            );
        }

        clearSessionCookie(
            res
        );

        res.json({

            success: true,

            message:
                "Вы вышли из аккаунта"

        });
    }
);


/* =====================================================
   GET USER CART
===================================================== */

app.get(
    "/api/cart",
    requireAuth,
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT
                        cart_items.id,
                        cart_items.product_id,
                        cart_items.quantity,

                        products.name,
                        products.description,
                        products.price,
                        products.image,
                        products.stock,
                        products.category

                    FROM cart_items

                    INNER JOIN products
                        ON products.id =
                           cart_items.product_id

                    WHERE cart_items.user_id = $1

                    ORDER BY cart_items.id ASC
                    `,
                    [
                        req.user.id
                    ]
                );

            res.json({

                success: true,

                cart:
                    result.rows

            });

        } catch (error) {

            console.error(
                "GET CART ERROR:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Ошибка загрузки корзины"

            });
        }
    }
);


/* =====================================================
   ADD TO CART
===================================================== */

app.post(
    "/api/cart",
    requireAuth,
    async (req, res) => {

        try {

            const productId =
                Number(
                    req.body.productId
                );

            const quantity =
                Number(
                    req.body.quantity
                ) || 1;

            if (
                !Number.isInteger(
                    productId
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Неверный productId"

                });
            }

            if (
                !Number.isInteger(
                    quantity
                ) ||
                quantity < 1
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Количество должно быть больше 0"

                });
            }

            const productResult =
                await pool.query(
                    `
                    SELECT
                        id,
                        name,
                        price,
                        stock
                    FROM products
                    WHERE id = $1
                    LIMIT 1
                    `,
                    [
                        productId
                    ]
                );

            if (
                productResult.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Товар не найден"

                });
            }

            const product =
                productResult.rows[0];

            const stock =
                Number(product.stock) || 0;

            if (stock <= 0) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Товар закончился"

                });
            }

            const existingResult =
                await pool.query(
                    `
                    SELECT
                        id,
                        quantity
                    FROM cart_items
                    WHERE user_id = $1
                    AND product_id = $2
                    LIMIT 1
                    `,
                    [
                        req.user.id,
                        productId
                    ]
                );

            if (
                existingResult.rows.length > 0
            ) {

                const cartItem =
                    existingResult.rows[0];

                const oldQuantity =
                    Number(
                        cartItem.quantity
                    );

                const newQuantity =
                    oldQuantity +
                    quantity;

                if (
                    newQuantity > stock
                ) {

                    return res.status(400).json({

                        success: false,

                        message:
                            `В наличии только ${stock} шт.`

                    });
                }

                const updateResult =
                    await pool.query(
                        `
                        UPDATE cart_items

                        SET quantity = $1

                        WHERE id = $2

                        RETURNING
                            id,
                            user_id,
                            product_id,
                            quantity,
                            created_at
                        `,
                        [
                            newQuantity,
                            cartItem.id
                        ]
                    );

                return res.json({

                    success: true,

                    item:
                        updateResult.rows[0]

                });
            }

            if (
                quantity > stock
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        `В наличии только ${stock} шт.`

                });
            }

            const insertResult =
                await pool.query(
                    `
                    INSERT INTO cart_items
                    (
                        user_id,
                        product_id,
                        quantity
                    )

                    VALUES
                    (
                        $1,
                        $2,
                        $3
                    )

                    RETURNING
                        id,
                        user_id,
                        product_id,
                        quantity,
                        created_at
                    `,
                    [
                        req.user.id,
                        productId,
                        quantity
                    ]
                );

            res.json({

                success: true,

                item:
                    insertResult.rows[0]

            });

        } catch (error) {

            console.error(
                "ADD CART ERROR:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Ошибка добавления в корзину"

            });
        }
    }
);


/* =====================================================
   REMOVE PRODUCT FROM CART
===================================================== */

app.delete(
    "/api/cart/:productId",
    requireAuth,
    async (req, res) => {

        try {

            const productId =
                Number(
                    req.params.productId
                );

            if (
                !Number.isInteger(
                    productId
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Неверный productId"

                });
            }

            await pool.query(
                `
                DELETE FROM cart_items

                WHERE user_id = $1
                AND product_id = $2
                `,
                [
                    req.user.id,
                    productId
                ]
            );

            res.json({

                success: true

            });

        } catch (error) {

            console.error(
                "DELETE CART ITEM ERROR:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Ошибка удаления товара"

            });
        }
    }
);


/* =====================================================
   CLEAR CART
===================================================== */

app.delete(
    "/api/cart",
    requireAuth,
    async (req, res) => {

        try {

            await pool.query(
                `
                DELETE FROM cart_items
                WHERE user_id = $1
                `,
                [
                    req.user.id
                ]
            );

            res.json({

                success: true,

                message:
                    "Корзина очищена"

            });

        } catch (error) {

            console.error(
                "CLEAR CART ERROR:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Ошибка очистки корзины"

            });
        }
    }
);/* =====================================================
   UPDATE CART QUANTITY
===================================================== */

app.put(
    "/api/cart/:productId",
    requireAuth,
    async (req, res) => {

        try {

            const productId =
                Number(
                    req.params.productId
                );

            const quantity =
                Number(
                    req.body.quantity
                );

            if (
                !Number.isInteger(
                    productId
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Неверный productId"

                });
            }

            if (
                !Number.isInteger(
                    quantity
                ) ||
                quantity < 1
            ) {

                await pool.query(
                    `
                    DELETE FROM cart_items

                    WHERE user_id = $1
                    AND product_id = $2
                    `,
                    [
                        req.user.id,
                        productId
                    ]
                );

                return res.json({

                    success: true

                });
            }

            const productResult =
                await pool.query(
                    `
                    SELECT
                        stock
                    FROM products
                    WHERE id = $1
                    LIMIT 1
                    `,
                    [
                        productId
                    ]
                );

            if (
                productResult.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Товар не найден"

                });
            }

            const stock =
                Number(
                    productResult.rows[0].stock
                );

            if (
                quantity > stock
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        `В наличии только ${stock} шт.`

                });
            }

            const result =
                await pool.query(
                    `
                    UPDATE cart_items

                    SET quantity = $1

                    WHERE user_id = $2
                    AND product_id = $3

                    RETURNING
                        id,
                        user_id,
                        product_id,
                        quantity,
                        created_at
                    `,
                    [
                        quantity,
                        req.user.id,
                        productId
                    ]
                );

            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Товар отсутствует в корзине"

                });
            }

            res.json({

                success: true,

                item:
                    result.rows[0]

            });

        } catch (error) {

            console.error(
                "UPDATE CART ERROR:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Ошибка изменения количества"

            });
        }
    }
);


/* =====================================================
   ADMIN CHECK
===================================================== */

app.get("/api/admin/check", (req, res) => {
    res.json({
        success: true,
        admin: true,
        user: {
            email: "admin@urban.pl"
        }
    });
});


/* =====================================================
   ADMIN GET PRODUCTS
===================================================== */

app.get(
    "/api/admin/products",
    requireAdmin,
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT
                        id,
                        name,
                        description,
                        price,
                        image,
                        stock,
                        created_at,
                        category
                    FROM products
                    ORDER BY id DESC
                    `
                );

            res.json({

                success: true,

                products:
                    result.rows

            });

        } catch (error) {

            console.error(
                "ADMIN PRODUCTS ERROR:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Ошибка загрузки товаров"

            });
        }
    }
);


/* =====================================================
   ADMIN CREATE PRODUCT
===================================================== */

app.post(
    "/api/admin/products",
    requireAdmin,
    async (req, res) => {

        try {

            const {
                name,
                description,
                price,
                image,
                stock,
                category
            } = req.body;

            const cleanName =
                String(name || "").trim();

            const cleanDescription =
                String(
                    description || ""
                ).trim();

            const cleanImage =
                String(
                    image || ""
                ).trim();

            const cleanCategory =
                String(
                    category || ""
                ).trim();

            const cleanPrice =
                Number(price);

            const cleanStock =
                Number(stock);

            if (!cleanName) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Введите название товара"

                });
            }

            if (
                !Number.isFinite(
                    cleanPrice
                ) ||
                cleanPrice < 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Введите правильную цену"

                });
            }

            if (
                !Number.isInteger(
                    cleanStock
                ) ||
                cleanStock < 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Введите правильное количество"

                });
            }

            const result =
                await pool.query(
                    `
                    INSERT INTO products
                    (
                        name,
                        description,
                        price,
                        image,
                        stock,
                        category
                    )

                    VALUES
                    (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6
                    )

                    RETURNING *
                    `,
                    [
                        cleanName,
                        cleanDescription,
                        cleanPrice,
                        cleanImage,
                        cleanStock,
                        cleanCategory
                    ]
                );

            res.status(201).json({

                success: true,

                product:
                    result.rows[0]

            });

        } catch (error) {

            console.error(
                "ADMIN CREATE PRODUCT ERROR:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Ошибка добавления товара"

            });
        }
    }
);/* =====================================================
   ADMIN UPDATE PRODUCT
===================================================== */

app.put(
    "/api/admin/products/:id",
    requireAdmin,
    async (req, res) => {

        try {

            const productId =
                Number(
                    req.params.id
                );

            if (
                !Number.isInteger(
                    productId
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Неверный ID товара"

                });
            }

            const {
                name,
                description,
                price,
                image,
                stock,
                category
            } = req.body;

            const cleanName =
                String(
                    name || ""
                ).trim();

            const cleanDescription =
                String(
                    description || ""
                ).trim();

            const cleanImage =
                String(
                    image || ""
                ).trim();

            const cleanCategory =
                String(
                    category || ""
                ).trim();

            const cleanPrice =
                Number(price);

            const cleanStock =
                Number(stock);

            if (!cleanName) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Введите название товара"

                });
            }

            if (
                !Number.isFinite(
                    cleanPrice
                ) ||
                cleanPrice < 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Введите правильную цену"

                });
            }

            if (
                !Number.isInteger(
                    cleanStock
                ) ||
                cleanStock < 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Введите правильное количество"

                });
            }

            const result =
                await pool.query(
                    `
                    UPDATE products

                    SET
                        name = $1,
                        description = $2,
                        price = $3,
                        image = $4,
                        stock = $5,
                        category = $6

                    WHERE id = $7

                    RETURNING *
                    `,
                    [
                        cleanName,
                        cleanDescription,
                        cleanPrice,
                        cleanImage,
                        cleanStock,
                        cleanCategory,
                        productId
                    ]
                );

            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Товар не найден"

                });
            }

            res.json({

                success: true,

                product:
                    result.rows[0]

            });

        } catch (error) {

            console.error(
                "ADMIN UPDATE PRODUCT ERROR:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Ошибка изменения товара"

            });
        }
    }
);


/* =====================================================
   ADMIN DELETE PRODUCT
===================================================== */

app.delete(
    "/api/admin/products/:id",
    requireAdmin,
    async (req, res) => {

        try {

            const productId =
                Number(
                    req.params.id
                );

            if (
                !Number.isInteger(
                    productId
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Неверный ID товара"

                });
            }

            await pool.query(
                `
                DELETE FROM cart_items
                WHERE product_id = $1
                `,
                [
                    productId
                ]
            );

            const result =
                await pool.query(
                    `
                    DELETE FROM products
                    WHERE id = $1
                    RETURNING *
                    `,
                    [
                        productId
                    ]
                );

            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Товар не найден"

                });
            }

            res.json({

                success: true,

                message:
                    "Товар удалён",

                product:
                    result.rows[0]

            });

        } catch (error) {

            console.error(
                "ADMIN DELETE PRODUCT ERROR:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Ошибка удаления товара"

            });
        }
    }
);


/* =====================================================
   ADMIN USERS
===================================================== */

app.get(
    "/api/admin/users",
    requireAdmin,
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT
                        id,
                        name,
                        email,
                        created_at
                    FROM users
                    ORDER BY id DESC
                    `
                );

            res.json({

                success: true,

                users:
                    result.rows

            });

        } catch (error) {

            console.error(
                "ADMIN USERS ERROR:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Ошибка загрузки пользователей"

            });
        }
    }
);/* =====================================================
   ADMIN CART STATISTICS
===================================================== */

app.get(
    "/api/admin/cart",
    requireAdmin,
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT
                        cart_items.id,
                        cart_items.user_id,
                        cart_items.product_id,
                        cart_items.quantity,

                        users.name AS user_name,
                        users.email AS user_email,

                        products.name AS product_name,
                        products.price AS product_price

                    FROM cart_items

                    LEFT JOIN users
                        ON users.id =
                           cart_items.user_id

                    LEFT JOIN products
                        ON products.id =
                           cart_items.product_id

                    ORDER BY cart_items.id DESC
                    `
                );

            res.json({

                success: true,

                items:
                    result.rows

            });

        } catch (error) {

            console.error(
                "ADMIN CART ERROR:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Ошибка загрузки корзин"

            });
        }
    }
);


/* =====================================================
   ADMIN PRODUCT STOCK
===================================================== */

app.patch(
    "/api/admin/products/:id/stock",
    requireAdmin,
    async (req, res) => {

        try {

            const productId =
                Number(
                    req.params.id
                );

            const stock =
                Number(
                    req.body.stock
                );

            if (
                !Number.isInteger(
                    productId
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Неверный ID товара"

                });
            }

            if (
                !Number.isInteger(
                    stock
                ) ||
                stock < 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Неверное количество"

                });
            }

            const result =
                await pool.query(
                    `
                    UPDATE products

                    SET stock = $1

                    WHERE id = $2

                    RETURNING *
                    `,
                    [
                        stock,
                        productId
                    ]
                );

            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Товар не найден"

                });
            }

            res.json({

                success: true,

                product:
                    result.rows[0]

            });

        } catch (error) {

            console.error(
                "ADMIN STOCK ERROR:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Ошибка изменения количества"

            });
        }
    }
);


/* =====================================================
   ADMIN PRODUCT PRICE
===================================================== */

app.patch(
    "/api/admin/products/:id/price",
    requireAdmin,
    async (req, res) => {

        try {

            const productId =
                Number(
                    req.params.id
                );

            const price =
                Number(
                    req.body.price
                );

            if (
                !Number.isInteger(
                    productId
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Неверный ID товара"

                });
            }

            if (
                !Number.isFinite(
                    price
                ) ||
                price < 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Неверная цена"

                });
            }

            const result =
                await pool.query(
                    `
                    UPDATE products

                    SET price = $1

                    WHERE id = $2

                    RETURNING *
                    `,
                    [
                        price,
                        productId
                    ]
                );

            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Товар не найден"

                });
            }

            res.json({

                success: true,

                product:
                    result.rows[0]

            });

        } catch (error) {

            console.error(
                "ADMIN PRICE ERROR:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Ошибка изменения цены"

            });
        }
    }
);


/* =====================================================
   ADMIN DASHBOARD STATS
===================================================== */

app.get(
    "/api/admin/stats",
    requireAdmin,
    async (req, res) => {

        try {

            const productsResult =
                await pool.query(
                    `
                    SELECT COUNT(*)::int AS count
                    FROM products
                    `
                );

            const usersResult =
                await pool.query(
                    `
                    SELECT COUNT(*)::int AS count
                    FROM users
                    `
                );

            const cartResult =
                await pool.query(
                    `
                    SELECT
                        COALESCE(
                            SUM(quantity),
                            0
                        )::int AS count
                    FROM cart_items
                    `
                );

            const stockResult =
                await pool.query(
                    `
                    SELECT
                        COALESCE(
                            SUM(stock),
                            0
                        )::int AS count
                    FROM products
                    `
                );

            res.json({

                success: true,

                stats: {

                    products:
                        productsResult
                            .rows[0]
                            .count,

                    users:
                        usersResult
                            .rows[0]
                            .count,

                    cartItems:
                        cartResult
                            .rows[0]
                            .count,

                    totalStock:
                        stockResult
                            .rows[0]
                            .count

                }

            });

        } catch (error) {

            console.error(
                "ADMIN STATS ERROR:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Ошибка получения статистики"

            });
        }
    }
);/* =====================================================
   ADMIN ORDERS CHECK
===================================================== */

app.get(
    "/api/admin/orders",
    requireAdmin,
    async (req, res) => {

        try {

            const tableCheck =
                await pool.query(
                    `
                    SELECT
                        EXISTS (
                            SELECT 1
                            FROM information_schema.tables
                            WHERE table_schema = 'public'
                            AND table_name = 'orders'
                        ) AS exists
                    `
                );

            const exists =
                tableCheck
                    .rows[0]
                    .exists;

            if (!exists) {

                return res.json({

                    success: true,

                    orders: [],

                    message:
                        "Таблица orders пока не создана"

                });
            }

            const result =
                await pool.query(
                    `
                    SELECT *
                    FROM orders
                    ORDER BY id DESC
                    `
                );

            res.json({

                success: true,

                orders:
                    result.rows

            });

        } catch (error) {

            console.error(
                "ADMIN ORDERS ERROR:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Ошибка загрузки заказов"

            });
        }
    }
);


/* =====================================================
   ADMIN PROFILE
===================================================== */

app.get(
    "/api/admin/profile",
    requireAdmin,
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT
                        id,
                        name,
                        email,
                        created_at
                    FROM users
                    WHERE id = $1
                    LIMIT 1
                    `,
                    [
                        req.user.id
                    ]
                );

           if (result.rows.length === 0) {
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Администратор не найден"

                });
            }

            res.json({

                success: true,

                admin:
                    result.rows[0]

            });

        } catch (error) {

            console.error(
                "ADMIN PROFILE ERROR:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Ошибка получения профиля"

            });
        }
    }
);


/* =====================================================
   HEALTH CHECK
===================================================== */

app.get(
    "/api/health",
    async (req, res) => {

        try {

            await pool.query(
                "SELECT 1"
            );

            res.json({

                success: true,

                server:
                    "online",

                database:
                    "online"

            });

        } catch (error) {

            res.status(500).json({

                success: false,

                server:
                    "online",

                database:
                    "offline"

            });
        }
    }
);


/* =====================================================
   404 API
===================================================== */

app.use(
    "/api",
    (req, res) => {

        res.status(404).json({

            success: false,

            message:
                "API маршрут не найден"

        });
    }
);


/* =====================================================
   ERROR HANDLER
===================================================== */

app.use(
    (error, req, res, next) => {

        console.error(
            "SERVER ERROR:",
            error
        );

        if (
            res.headersSent
        ) {

            return next(error);

        }

        res.status(500).json({

            success: false,

            message:
                "Внутренняя ошибка сервера"

        });
    }
);


/* =====================================================
   SERVER
===================================================== */

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
        console.log(
            "================================="
        );

        console.log(
            `URBAN STORE: http://localhost:${PORT}`
        );

        console.log(Ф
            "PostgreSQL + Users + Cart"
        );

        console.log(
            "Admin: " + ADMIN_EMAIL
        );

        console.log(
            "================================="
        );

    }
);/*
   Этот блок оставлен для совместимости
   с текущей структурой проекта.

   Основные маршруты уже определены выше.
*/


/* =====================================================
   DATABASE ERROR HANDLING
===================================================== */

pool.on(
    "error",
    (error) => {

        console.error(
            "POSTGRESQL POOL ERROR:",
            error
        );

    }
);


/* =====================================================
   GRACEFUL SHUTDOWN
===================================================== */

async function shutdown() {

    console.log(
        "\nОстановка URBAN STORE..."
    );

    try {

        await pool.end();

        console.log(
            "PostgreSQL connection closed."
        );

    } catch (error) {

        console.error(
            "Ошибка закрытия PostgreSQL:",
            error
        );

    }

    process.exit(0);
}


process.on(
    "SIGINT",
    shutdown
);

process.on(
    "SIGTERM",
    shutdown
);


/* =====================================================
   UNHANDLED ERRORS
===================================================== */

process.on(
    "unhandledRejection",
    (error) => {

        console.error(
            "UNHANDLED REJECTION:",
            error
        );

    }
);

process.on(
    "uncaughtException",
    (error) => {

        console.error(
            "UNCAUGHT EXCEPTION:",
            error
        );

    }
);/* =====================================================
   END OF SERVER
===================================================== */

/*
   URBAN STORE
   PostgreSQL
   Users
   Authentication
   Cart
   Admin Panel

   Server:
   http://localhost:3000

   Admin:
   http://localhost:3000/admin

   Admin email:
   admin@urban.pl
*/


console.log(
    "URBAN STORE server file loaded."
);