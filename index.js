const axios = require("axios");
const express = require("express");
const Sequelize = require("sequelize");
const Joi = require("joi");
const { QueryTypes } = require("sequelize");

const app = express();
const sequelize = new Sequelize("t5_soa_220116919", "root", "", {
  host: "localhost",
  port: 3306,
  dialect: "mysql",
});

app.use(express.urlencoded({ extended: true }));

async function checkUsernameExists(username) {
  const result = await sequelize.query(
    "SELECT * FROM users WHERE username = ?",
    {
      type: QueryTypes.SELECT,
      replacements: [username],
    }
  );
  if (result.length > 0) {
    return true;
  }
  return false;
}

async function getLastId() {
  const result = await sequelize.query("SELECT id FROM news ORDER BY id DESC", {
    type: QueryTypes.SELECT,
  });
  return result[0].id;
}

async function generateIdNews() {
  const result = await sequelize.query(
    "SELECT id FROM news ORDER BY id DESC LIMIT 1",
    {
      type: QueryTypes.SELECT,
    }
  );
  return `NW${result[0].id.toString().padStart(4, "0")}`;
}

async function checkUsernameRegistered(username) {
  const result = await sequelize.query(
    "SELECT * FROM users WHERE username = ?",
    {
      type: QueryTypes.SELECT,
      replacements: [username],
    }
  );
  if (result.length === 0) {
    throw new Error("Username belum terdaftar!");
  }
}

async function checkIdNewsRegistered(username) {
  const result = await sequelize.query("SELECT * FROM news WHERE id_news = ?", {
    type: QueryTypes.SELECT,
    replacements: [username],
  });
  if (result.length === 0) {
    throw new Error("Id News belum terdaftar!");
  }
}

async function findNewsAction(news_id, username) {
  const result = await sequelize.query(
    "SELECT * FROM news_users WHERE id_news = ? AND username = ?",
    {
      type: QueryTypes.SELECT,
      replacements: [news_id, username],
    }
  );
  if (result.length > 0) {
    return result[0];
  }
  return null;
}

async function findNews(news_id) {
  const result = await sequelize.query("SELECT * FROM news WHERE id_news = ?", {
    type: QueryTypes.SELECT,
    replacements: [news_id],
  });
  if (result.length > 0) {
    return result[0];
  }
  return null;
}

// NOMOR 1
app.post("/api/users/login", async (req, res) => {
  const { username, password } = req.body;

  // VALIDATION
  const schema = Joi.object({
    username: Joi.string().required(),
    password: Joi.string().required(),
  });

  try {
    await schema.validateAsync(req.body);
  } catch (error) {
    return res.status(400).send({ message: error.message });
  }

  // CHECK USERNAME EXISTS
  if (await checkUsernameExists(username)) {
    const result = await sequelize.query(
      "SELECT * FROM users WHERE username = ? AND password = ?",
      {
        type: QueryTypes.SELECT,
        replacements: [username, password],
      }
    );
    if (result.length > 0) {
      return res.status(200).send({ message: "Berhasil login" });
    }
    return res
      .status(400)
      .send({ message: "Gagal login, password tidak sesuai" });
  }

  // INSERT USER
  await sequelize.query(
    "INSERT INTO users (username, password) VALUES (?, ?)",
    {
      replacements: [username, password],
    }
  );

  return res
    .status(201)
    .send({ message: `Berhasil menambahkan username ${username}` });
});

// NOMOR 2
app.post("/api/news", async (req, res) => {
  const apiKey = req.headers["x-api-key"];
  let { query, cari_di } = req.body;

  // CHECK API KEY
  if (!apiKey) return res.status(401).send("API Key tidak ditemukan!");

  // VALIDATION
  const schema = Joi.object({
    query: Joi.string().min(2).required(),
    cari_di: Joi.string().valid("title", "description", "content").required(),
  });

  try {
    await schema.validateAsync(req.body);
  } catch (error) {
    return res.status(400).send({ message: error.message });
  }

  // GET NEWS
  let news = await axios.get(
    `https://newsapi.org/v2/everything?q=${query}&searchIn=${cari_di}&apiKey=${apiKey}`
  );

  let article = news.data.articles[0];
  if (article) {
    // INSERT NEWS
    await sequelize.query(
      "INSERT INTO news (author, source, title, description, url, publishedAt) VALUES (?, ?, ?, ?, ?, ?)",
      {
        replacements: [
          article.author,
          article.source.name,
          article.title,
          article.description,
          article.url,
          article.publishedAt,
        ],
      }
    );

    // GENERATE ID NEWS NWXXXX
    const id = await getLastId();
    const id_news = await generateIdNews();

    // UPDATE ID NEWS
    await sequelize.query("UPDATE news SET id_news = ? WHERE id = ?", {
      replacements: [id_news, id],
    });

    return res.status(201).send({
      message: `Berhasil menambahkan berita ${id_news}`,
      news: {
        id_news,
        author: article.author,
        source: article.source.name,
        title: article.title,
        description: article.description,
        url: article.url,
        publishedAt: article.publishedAt,
      },
    });
  }

  return res.status(404).send({ message: "Berita tidak ditemukan!" });
});

// NOMOR 3
app.get("/api/sources", async (req, res) => {
  const apiKey = req.headers["x-api-key"];
  const { negara, bahasa } = req.query;

  // CHECK API KEY
  if (!apiKey) return res.status(401).send("API Key tidak ditemukan!");

  // VALIDATION
  const schema = Joi.object({
    negara: Joi.string()
      .valid(
        "ae",
        "ar",
        "at",
        "au",
        "be",
        "bg",
        "br",
        "ca",
        "ch",
        "cn",
        "co",
        "cu",
        "cz",
        "de",
        "eg",
        "fr",
        "gb",
        "gr",
        "hk",
        "hu",
        "id",
        "ie",
        "il",
        "in",
        "it",
        "jp",
        "kr",
        "lt",
        "lv",
        "ma",
        "mx",
        "my",
        "ng",
        "nl",
        "no",
        "nz",
        "ph",
        "pl",
        "pt",
        "ro",
        "rs",
        "ru",
        "sa",
        "se",
        "sg",
        "si",
        "sk",
        "th",
        "tr",
        "tw",
        "ua",
        "us",
        "ve",
        "za"
      )
      .required()
      .messages({
        "any.only": "Negara tidak sesuai!",
      }),
    bahasa: Joi.string()
      .valid(
        "ar",
        "de",
        "en",
        "es",
        "fr",
        "he",
        "it",
        "nl",
        "no",
        "pt",
        "ru",
        "sv",
        "ud",
        "zh"
      )
      .required()
      .messages({
        "any.only": "Bahasa tidak sesuai!",
      }),
  });

  try {
    await schema.validateAsync(req.query);
  } catch (error) {
    return res.status(400).send({ message: error.message });
  }

  // GET SOURCES
  let sources = await axios.get(
    `https://newsapi.org/v2/top-headlines/sources?country=${negara}&language=${bahasa}&apiKey=${apiKey}`
  );

  if (sources.data.status === "ok" && sources.data.sources.length > 0) {
    let result = [];
    sources.data.sources.forEach((source) => {
      result.push({ id: source.id, name: source.name });
    });
    return res.status(200).send({ source: result });
  }

  return res.status(404).send({ message: "Source tidak ditemukan!" });
});

// NOMOR 4
app.post("/api/sources", async (req, res) => {
  const apiKey = req.headers["x-api-key"];
  const { negara, bahasa, id_source } = req.body;

  // CHECK API KEY
  if (!apiKey) return res.status(401).send("API Key tidak ditemukan!");

  // VALIDATION
  const schema = Joi.object({
    negara: Joi.string()
      .valid(
        "ae",
        "ar",
        "at",
        "au",
        "be",
        "bg",
        "br",
        "ca",
        "ch",
        "cn",
        "co",
        "cu",
        "cz",
        "de",
        "eg",
        "fr",
        "gb",
        "gr",
        "hk",
        "hu",
        "id",
        "ie",
        "il",
        "in",
        "it",
        "jp",
        "kr",
        "lt",
        "lv",
        "ma",
        "mx",
        "my",
        "ng",
        "nl",
        "no",
        "nz",
        "ph",
        "pl",
        "pt",
        "ro",
        "rs",
        "ru",
        "sa",
        "se",
        "sg",
        "si",
        "sk",
        "th",
        "tr",
        "tw",
        "ua",
        "us",
        "ve",
        "za"
      )
      .required()
      .messages({
        "any.only": "Negara tidak sesuai!",
      }),
    bahasa: Joi.string()
      .valid(
        "ar",
        "de",
        "en",
        "es",
        "fr",
        "he",
        "it",
        "nl",
        "no",
        "pt",
        "ru",
        "sv",
        "ud",
        "zh"
      )
      .required()
      .messages({
        "any.only": "Bahasa tidak sesuai!",
      }),
    id_source: Joi.string().required(),
  });

  try {
    await schema.validateAsync(req.body);
  } catch (error) {
    return res.status(400).send({ message: error.message });
  }

  // GET SOURCES
  let sources = await axios.get(
    `https://newsapi.org/v2/top-headlines/sources?country=${negara}&language=${bahasa}&apiKey=${apiKey}`
  );

  if (sources.data.status === "ok" && sources.data.sources.length > 0) {
    let result;
    sources.data.sources.forEach((source) => {
      if (source.id === id_source) {
        result = {
          id: source.id,
          name: source.name,
          description: source.description,
          url: source.url,
          category: source.category,
          language: source.language,
          country: source.country,
        };
      }
    });

    if (result) {
      try {
        await sequelize.query(
          `INSERT INTO sources (id, name, description, url, category, language, country) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          {
            replacements: [
              result.id,
              result.name,
              result.description,
              result.url,
              result.category,
              result.language,
              result.country,
            ],
          }
        );
      } catch (error) {
        return res.status(409).send({ message: "Source sudah ada!" });
      }

      return res.status(201).send({
        message: `Berhasil menambahkan source ${id_source}`,
        source: result,
      });
    }
    return res.status(404).send({ message: "Source tidak ditemukan!" });
  }

  return res.status(404).send({ message: "Source tidak ditemukan!" });
});

// NOMOR 5
app.post("/api/news/action", async (req, res) => {
  const { username, id_news, action } = req.body;

  // VALIDATION
  const schema = Joi.object({
    username: Joi.string().external(checkUsernameRegistered).required(),
    id_news: Joi.string().external(checkIdNewsRegistered).required(),
    action: Joi.string().valid("like", "dislike", "neutral").required(),
  });

  try {
    await schema.validateAsync(req.body);
  } catch (error) {
    return res.status(400).send({ message: error.message });
  }

  let news = await findNewsAction(id_news, username);
  let message;

  if (news && news.action === action) {
    if (action === "like") {
      message = "User sudah pernah melakukan like.";
    } else if (action === "dislike") {
      message = "User sudah pernah melakukan dislike.";
    } else {
      message = "User sudah pernah menghapus like/dislike.";
    }
    return res.status(400).send({ message });
  }

  if (news) {
    // UPDATE NEWS_USERS
    await sequelize.query(
      "UPDATE news_users SET action = ? WHERE id_news = ? AND username = ?",
      {
        replacements: [action, id_news, username],
      }
    );
  } else {
    // INSERT NEWS_USERS
    await sequelize.query(
      "INSERT INTO news_users (id_news, username, action) VALUES (?, ?, ?)",
      {
        replacements: [id_news, username, action],
      }
    );
  }

  if (action === "like") {
    message = "Berhasil melakukan like.";
  } else if (action === "dislike") {
    message = "Berhasil melakukan dislike.";
  } else {
    message = "Berhasil menghapus like/dislike.";
  }

  news = await findNews(id_news);
  let list_likes = await sequelize.query(
    "SELECT action, count(*) as jumlah FROM news_users GROUP BY action",
    {
      type: QueryTypes.SELECT,
    }
  );

  let likes = 0;
  if (list_likes.length > 0) {
    for (let i = 0; i < list_likes.length; i++) {
      if (list_likes[i].action === "like") {
        likes += list_likes[i].jumlah;
      } else if (list_likes[i].action === "dislike") {
        likes -= list_likes[i].jumlah;
      }
    }
  }

  return res.status(200).send({
    message,
    news: {
      id_news: news.id_news,
      author: news.author,
      source: news.source,
      title: news.title,
      description: news.description,
      url: news.url,
      publishedAt: news.publishedAt,
      likes,
    },
  });
});

// NOMOR 6
app.delete("/api/news", async (req, res) => {
  const { id_news } = req.body;

  // VALIDATION
  const schema = Joi.object({
    id_news: Joi.string().required(),
  });

  try {
    await schema.validateAsync(req.body);
  } catch (error) {
    return res.status(400).send({ message: error.message });
  }

  // FIND NEWS
  let news = await findNews(id_news);
  if (!news) {
    return res.status(404).send({ message: `News ${id_news} tidak ditemukan` });
  }

  // DELETE NEWS & NEWS_USERS
  await sequelize.query("DELETE FROM news_users WHERE id_news = ?", {
    replacements: [id_news],
  });

  await sequelize.query("DELETE FROM news WHERE id_news = ?", {
    replacements: [id_news],
  });

  return res.status(200).send({ message: `News ${id_news} berhasil dihapus` });
});

app.listen(3000, () => console.log("Server running at port 3000"));
