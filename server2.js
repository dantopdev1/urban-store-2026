require("dotenv").config();

const express = require("express");
const { Pool } = require("pg");
const crypto = require("crypto");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

/* =====================================================
   POSTGRESQL
===================================================== */

const isLocalDatabase =
    !process.env.DATABASE_URL ||
    /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);

const poolConfig = process.env.DATABASE_URL
    ? {
          connectionString: process.env.DATABASE_URL,
          ssl: isLocalDatabase
              ? false
              : { rejectUnauthorized: false }
      }
    : {
          user: process.env.DB_USER,
          host: process.env.DB_HOST,
          database: process.env.DB_NAME,
          password: process.env.DB_PASSWORD,
          port: Number(process.env.DB_PORT) || 5432,
          ssl: false
      };

const pool = new Pool(poolConfig);

pool.on("error", (error) => {
    console.error("POSTGRESQL POOL ERROR:", error);
});

/* =====================================================
   ADMIN
===================================================== */

const ADMIN_EMAIL = "admin@urban.pl";

const ADMIN_PASSWORD =
    process.env.ADMIN_PASSWORD || "UrbanAdmin2026!";

/* =====================================================
   SESSIONS
===================================================== */

const sessions = new Map();

/* =====================================================
   PASSWORD
===================================================== */

function hashPassword(password) {
    const salt =
        crypto.randomBytes(16).toString("hex");

    const hash =
        crypto
            .scryptSync(password, salt, 64)
            .toString("hex");

    return `${salt}:${hash}`;
}

function verifyPassword(password, storedPassword) {
    try {
        if (!storedPassword) {
            return false;
        }

        const parts =
            String(storedPassword).split(":");

        if (parts.length !== 2) {
            return false;
        }

        const salt = parts[0];
        const storedHash = parts[1];

        const hash =
            crypto
                .scryptSync(password, salt, 64)
                .toString("hex");

        const a = Buffer.from(hash, "hex");
        const b = Buffer.from(storedHash, "hex");

        return (
            a.length === b.length &&
            crypto.timingSafeEqual(a, b)
        );

    } catch (error) {
        console.error(
            "PASSWORD VERIFY ERROR:",
            error
        );

        return false;
    }
}

function isAdminEmail(email) {
    return (
        String(email || "")
            .trim()
            .toLowerCase() ===
        ADMIN_EMAIL.toLowerCase()
    );
}

/* =====================================================
   SESSION
===================================================== */

function createSession(user) {
    const token =
        crypto
            .randomBytes(32)
            .toString("hex");

    sessions.set(token, {
        id: user.id,
        name: user.name,
        email: user.email,
        isAdmin:
            isAdminEmail(user.email)
    });

    return token;
}

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
        sessions.get(match[1]) ||
        null
    );
}

function setSessionCookie(res, token) {
    res.setHeader(
        "Set-Cookie",
        `urban_session=${token}; HttpOnly; Path=/; SameSite=Lax`
    );
}

function clearSessionCookie(res) {
    res.setHeader(
        "Set-Cookie",
        "urban_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax"
    );
}

/* =====================================================
   AUTH
===================================================== */

function requireAuth(req, res, next) {
    const user =
        getSession(req);

    if (!user) {
        return res.status(401).json({
            success: false,
            message:
                "Необходимо войти в аккаунт"
        });
    }

    req.user = user;

    next();
}

function requireAdmin(req, res, next) {
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
        !isAdminEmail(user.email)
    ) {
        return res.status(403).json({
            success: false,
            message:
                "Доступ запрещён"
        });
    }

    req.user = user;

    next();
}

/* =====================================================
   ADMIN PAGE
===================================================== */

app.get("/admin", (req, res) => {
    const user =
        getSession(req);

    if (!user) {
        return res.redirect("/");
    }

    if (
        !isAdminEmail(user.email)
    ) {
        return res.status(403).send(
            "Доступ запрещён"
        );
    }

    const candidates = [
        path.join(
            __dirname,
            "admin.html"
        ),
        path.join(
            __dirname,
            "admin.html",
            "admin.html"
        )
    ];

    const fs = require("fs");

    const file =
        candidates.find(
            (item) =>
                fs.existsSync(item)
        );

    if (!file) {
        return res.status(404).send(
            "Файл admin.html не найден"
        );
    }

    res.sendFile(file);
});

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
                await pool.query(`
                   SELECT
    id,
    name,
    description,
    price,
    image,
    stock,
    created_at,
    category,
    gender,
    is_new,
    is_sale
FROM products
ORDER BY id ASC
                `);

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
                String(name)
                    .trim();

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

            if (
                isAdminEmail(
                    cleanEmail
                )
            ) {

                return res.status(403).json({
                    success: false,
                    message:
                        "Этот email зарезервирован для администратора"
                });
            }

            const existing =
                await pool.query(
                    `
                    SELECT id
                    FROM users
                    WHERE LOWER(email) = LOWER($1)
                    LIMIT 1
                    `,
                    [cleanEmail]
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
                user: {
                    ...user,
                    isAdmin: false
                }
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
                        "Заполни все поля"
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
                    WHERE LOWER(email) = LOWER($1)
                    LIMIT 1
                    `,
                    [cleanEmail]
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

            const admin =
                isAdminEmail(
                    user.email
                );

            res.json({
                success: true,

                message:
                    admin
                        ? "Вход администратора выполнен"
                        : "Вход выполнен",

                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    isAdmin: admin,
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
);

/* =====================================================
   CURRENT USER
===================================================== */

app.get(
    "/api/me",
    (req, res) => {

        const user =
            getSession(req);

        if (!user) {

            return res.json({
                loggedIn: false,
                user: null
            });
        }

        res.json({
            loggedIn: true,

            user: {
                ...user,
                isAdmin:
                    isAdminEmail(
                        user.email
                    )
            }
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
   CART - GET
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
                        COALESCE(
                            cart_items.size,
                            'S'
                        ) AS size,

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

                    WHERE cart_items.user_id =
                        $1

                    ORDER BY cart_items.id ASC
                    `,
                    [req.user.id]
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
   CART - ADD
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

            const size =
                String(
                    req.body.size || "S"
                ).trim();

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
                    [productId]
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
                Number(
                    product.stock
                ) || 0;

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
                        quantity,
                        size
                    FROM cart_items
                    WHERE user_id = $1
                      AND product_id = $2
                      AND COALESCE(size, 'S') = $3
                    LIMIT 1
                    `,
                    [
                        req.user.id,
                        productId,
                        size
                    ]
                );

            if (
                existingResult.rows.length > 0
            ) {

                const item =
                    existingResult.rows[0];

                const newQuantity =
                    Number(
                        item.quantity
                    ) + quantity;

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
                        SET
                            quantity = $1,
                            size = $2
                        WHERE id = $3
                        RETURNING *
                        `,
                        [
                            newQuantity,
                            size,
                            item.id
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
                        quantity,
                        size
                    )
                    VALUES
                    (
                        $1,
                        $2,
                        $3,
                        $4
                    )
                    RETURNING *
                    `,
                    [
                        req.user.id,
                        productId,
                        quantity,
                        size
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

            if (
                error.code === "23505"
            ) {

                return res.status(409).json({
                    success: false,
                    message:
                        "Этот товар уже есть в корзине"
                });
            }

            res.status(500).json({
                success: false,
                message:
                    "Ошибка добавления в корзину"
            });
        }
    }
);

/* =====================================================
   CART - UPDATE
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

            const size =
                String(
                    req.body.size || "S"
                ).trim();

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
                    SELECT stock
                    FROM products
                    WHERE id = $1
                    LIMIT 1
                    `,
                    [productId]
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
                    productResult.rows[0]
                        .stock
                ) || 0;

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
                    SET
                        quantity = $1,
                        size = $2
                    WHERE user_id = $3
                      AND product_id = $4
                    RETURNING *
                    `,
                    [
                        quantity,
                        size,
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
   CART - DELETE ITEM
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
                "DELETE CART ERROR:",
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
   CART - CLEAR
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
                [req.user.id]
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
);
/* =====================================================
   ADMIN CHECK
===================================================== */

app.get(
    "/api/admin/check",
    requireAdmin,
    (req, res) => {

        res.json({
            success: true,
            admin: true,
            user: req.user
        });
    }
);

/* =====================================================
   ADMIN PRODUCTS
===================================================== */

app.get(
    "/api/admin/products",
    requireAdmin,
    async (req, res) => {

        try {

            const result =
                await pool.query(`
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
                `);

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
);

app.put(
    "/api/admin/products/:id",
    requireAdmin,
    async (req, res) => {

        try {

            const productId =
                Number(
                    req.params.id
                );

            const {
                name,
                description,
                price,
                image,
                stock,
                category
            } = req.body;

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
                        String(
                            name || ""
                        ).trim(),

                        String(
                            description || ""
                        ).trim(),

                        Number(price),

                        String(
                            image || ""
                        ).trim(),

                        Number(stock),

                        String(
                            category || ""
                        ).trim(),

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
                [productId]
            );

            const result =
                await pool.query(
                    `
                    DELETE FROM products
                    WHERE id = $1
                    RETURNING *
                    `,
                    [productId]
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
                await pool.query(`
                    SELECT
                        id,
                        name,
                        email,
                        created_at
                    FROM users
                    ORDER BY id DESC
                `);

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
);

/* =====================================================
   ADMIN CART
===================================================== */

app.get(
    "/api/admin/cart",
    requireAdmin,
    async (req, res) => {

        try {

            const result =
                await pool.query(`
                    SELECT
                        cart_items.id,
                        cart_items.user_id,
                        cart_items.product_id,
                        cart_items.quantity,
                        COALESCE(
                            cart_items.size,
                            'S'
                        ) AS size,

                        users.name
                            AS user_name,

                        users.email
                            AS user_email,

                        products.name
                            AS product_name,

                        products.price
                            AS product_price

                    FROM cart_items

                    LEFT JOIN users
                        ON users.id =
                           cart_items.user_id

                    LEFT JOIN products
                        ON products.id =
                           cart_items.product_id

                    ORDER BY
                        cart_items.id DESC
                `);

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
   ADMIN STOCK
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
   ADMIN PRICE
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
   ADMIN STATS
===================================================== */

app.get(
    "/api/admin/stats",
    requireAdmin,
    async (req, res) => {

        try {

            const productsResult =
                await pool.query(
                    `
                    SELECT
                        COUNT(*)::int AS count
                    FROM products
                    `
                );

            const usersResult =
                await pool.query(
                    `
                    SELECT
                        COUNT(*)::int AS count
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
                    [req.user.id]
                );

            if (
                result.rows.length === 0
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
   HEALTH
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
                server: "online",
                database: "online"
            });

        } catch (error) {

            res.status(500).json({
                success: false,
                server: "online",
                database: "offline"
            });
        }
    }
);

/* =====================================================
   CREATE ORDER
===================================================== */

app.post(
    "/api/orders",
    requireAuth,
    async (req, res) => {

        const client =
            await pool.connect();

        try {

            const {
                customerName,
                phone,
                email,
                deliveryMethod,
                deliveryAddress,
                paymentMethod,
                items
            } = req.body;

            if (
                !customerName ||
                !phone ||
                !email ||
                !deliveryMethod ||
                !deliveryAddress ||
                !paymentMethod
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Заполните все поля"
                });
            }

            if (
                !Array.isArray(items) ||
                items.length === 0
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Корзина пуста"
                });
            }

            await client.query(
                "BEGIN"
            );

            let total = 0;

            const checkedItems = [];

            for (
                const item of items
            ) {

                const productId =
                    Number(
                        item.id ??
                        item.product_id
                    );

                const quantity =
                    Number(
                        item.quantity
                    );

                const size =
                    String(
                        item.size || "S"
                    ).trim();

                if (
                    !Number.isInteger(
                        productId
                    ) ||
                    !Number.isInteger(
                        quantity
                    ) ||
                    quantity < 1
                ) {

                    throw new Error(
                        "Неверные данные товара"
                    );
                }

                const productResult =
                    await client.query(
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
                        [productId]
                    );

                if (
                    productResult
                        .rows
                        .length === 0
                ) {

                    throw new Error(
                        `Товар ${productId} не найден`
                    );
                }

                const product =
                    productResult
                        .rows[0];

                const price =
                    Number(
                        product.price
                    ) || 0;

                const stock =
                    Number(
                        product.stock
                    ) || 0;

                if (
                    quantity > stock
                ) {

                    throw new Error(
                        `Недостаточно товара: ${product.name}. В наличии ${stock} шт.`
                    );
                }

                total +=
                    price *
                    quantity;

                checkedItems.push({
                    productId,
                    productName:
                        product.name,
                    size,
                    price,
                    quantity
                });
            }

            const orderResult =
                await client.query(
                    `
                    INSERT INTO orders
                    (
                        user_id,
                        customer_name,
                        phone,
                        email,
                        delivery_method,
                        delivery_address,
                        payment_method,
                        total,
                        status
                    )
                    VALUES
                    (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6,
                        $7,
                        $8,
                        $9
                    )
                    RETURNING *
                    `,
                    [
                        req.user.id,
                        String(
                            customerName
                        ).trim(),
                        String(
                            phone
                        ).trim(),
                        String(
                            email
                        ).trim(),
                        String(
                            deliveryMethod
                        ),
                        String(
                            deliveryAddress
                        ).trim(),
                        String(
                            paymentMethod
                        ),
                        total,
                        "new"
                    ]
                );

            const order =
                orderResult.rows[0];

            for (
                const item of checkedItems
            ) {

                await client.query(
                    `
                    INSERT INTO order_items
                    (
                        order_id,
                        product_id,
                        product_name,
                        size,
                        price,
                        quantity
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
                    `,
                    [
                        order.id,
                        item.productId,
                        item.productName,
                        item.size,
                        item.price,
                        item.quantity
                    ]
                );

                const stockUpdate =
                    await client.query(
                        `
                        UPDATE products
                        SET stock =
                            stock - $1
                        WHERE id = $2
                          AND stock >= $1
                        RETURNING id
                        `,
                        [
                            item.quantity,
                            item.productId
                        ]
                    );

                if (
                    stockUpdate
                        .rows
                        .length === 0
                ) {

                    throw new Error(
                        `Не удалось уменьшить остаток товара: ${item.productName}`
                    );
                }
            }

            await client.query(
                `
                DELETE FROM cart_items
                WHERE user_id = $1
                `,
                [req.user.id]
            );

            await client.query(
                "COMMIT"
            );

            res.json({
                success: true,
                order
            });

        } catch (error) {

            try {
                await client.query(
                    "ROLLBACK"
                );
            } catch (
                rollbackError
            ) {

                console.error(
                    "ROLLBACK ERROR:",
                    rollbackError
                );
            }

            console.error(
                "CREATE ORDER ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    error.message ||
                    "Ошибка создания заказа"
            });

        } finally {

            client.release();
        }
    }
);

/* =====================================================
   API 404
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
            return next(
                error
            );
        }

        res.status(500).json({
            success: false,
            message:
                "Внутренняя ошибка сервера"
        });
    }
);

/* =====================================================
   ENSURE ADMIN ACCOUNT
===================================================== */

async function ensureAdminAccount() {

    try {

        const result =
            await pool.query(
                `
                SELECT id
                FROM users
                WHERE LOWER(email) =
                      LOWER($1)
                LIMIT 1
                `,
                [ADMIN_EMAIL]
            );

        const passwordHash =
            hashPassword(
                ADMIN_PASSWORD
            );

        if (
            result.rows.length === 0
        ) {

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
                `,
                [
                    "URBAN ADMIN",
                    ADMIN_EMAIL,
                    passwordHash
                ]
            );

            console.log(
                "ADMIN ACCOUNT CREATED:",
                ADMIN_EMAIL
            );

        } else {

            await pool.query(
                `
                UPDATE users
                SET password_hash = $1
                WHERE LOWER(email) =
                      LOWER($2)
                `,
                [
                    passwordHash,
                    ADMIN_EMAIL
                ]
            );

            console.log(
                "ADMIN PASSWORD INITIALIZED:",
                ADMIN_EMAIL
            );
        }

    } catch (error) {

        console.error(
            "ADMIN ACCOUNT ERROR:",
            error
        );
    }
}

/* =====================================================
   START SERVER
===================================================== */

async function startServer() {

    try {

        await pool.query(
            "SELECT 1"
        );

        console.log(
            "PostgreSQL connection OK"
        );
await pool.query(`
    ALTER TABLE cart_items
    ADD COLUMN IF NOT EXISTS size TEXT DEFAULT 'S';
`);
        await ensureAdminAccount();

        app.get(
            "/sitemap.xml",
            (req, res) => {

                res.type(
                    "application/xml"
                );

                res.send(
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>https://urban-store-2026.onrender.com/</loc>
    </url>
</urlset>`
                );
            }
        );

        app.listen(
            PORT,
            "0.0.0.0",
            () => {

                console.log(
                    "================================="
                );

                console.log(
                    `URBAN STORE: http://localhost:${PORT}`
                );

                console.log(
                    "PostgreSQL + Users + Cart + Orders"
                );

                console.log(
                    "ADMIN: " +
                    ADMIN_EMAIL
                );

                console.log(
                    "================================="
                );
            }
        );

    } catch (error) {

        console.error(
            "SERVER START ERROR:",
            error
        );

        process.exit(1);
    }
}

/* =====================================================
   SHUTDOWN
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
);

startServer();

console.log(
    "URBAN STORE server file loaded."
);