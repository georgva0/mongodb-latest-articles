const request = require("request");
const fs = require("fs");

const certPass = process.env["CERT_PW"];
const thumbnailBaseUrl = "https://thumbnailer.tools.bbc.co.uk/optimo/976/";

const getTlsOptions = () => ({
  cert: fs.readFileSync("./credentials/cert2024.crt"),
  key: fs.readFileSync("./credentials/cert2024.key"),
  ca: fs.readFileSync("./credentials/CloudServicesRoot.pem"),
});

exports.extractArticleId = (urn) => {
  const match = /^urn:bbc:ares::article:([A-Za-z0-9]{12,13})$/.exec(urn || "");
  if (!match) {
    throw new Error(`Unable to extract an article ID from URN: ${urn}`);
  }
  return match[1];
};

exports.enrichDocument = async (document) => {
  const articleId = exports.extractArticleId(document.urn);
  const article = await exports.getArticle(articleId);

  if (!article || article === "404") {
    throw new Error(`ARES article not found: ${articleId}`);
  }

  const metadata = article.metadata || {};
  const locators = metadata.locators || article.locators || {};
  const promo = article.promo || {};
  const headlines = promo.headlines || {};
  const images = promo.images || {};
  const defaultPromoImage = images.defaultPromoImage || {};
  const imageModel = defaultPromoImage.model || {};
  const rawImageBlock = (defaultPromoImage.blocks || []).find(
    (block) => block.type === "rawImage",
  );
  const imageLocator = imageModel.locator || rawImageBlock?.model?.locator;

  return {
    ...document,
    metadata: {
      ...metadata,
      locators: {
        ...locators,
        canonicalUrl: locators.canonicalUrl,
      },
      createdBy: metadata.createdBy || article.createdBy,
      language: metadata.language || article.language,
    },
    consumableAsSFV: metadata.consumableAsSFV ?? article.consumableAsSFV,
    promo: {
      ...promo,
      headlines: {
        ...headlines,
        seoHeadline: headlines.seoHeadline,
      },
      images: {
        ...images,
        defaultPromoImage: {
          ...defaultPromoImage,
          model: {
            ...imageModel,
            locator: imageLocator
              ? `${thumbnailBaseUrl}${imageLocator}`
              : imageLocator,
          },
        },
      },
    },
  };
};

exports.getArticle = (id) => {
  return new Promise(function (resolve, reject) {
    console.log(`Ares: Calling Ares API - Optimo for ${id}`);
    const { cert, key, ca } = getTlsOptions();
    const opts = {
      cert: `${cert}`,
      key: `${key}`,
      passphrase: `${certPass}`,
      ca: `${ca}`,
      headers: {
        Accept: "application/json",
      },
      json: true,
      method: "GET",
      url: `https://ares-api.api.bbci.co.uk/api/article/${id}`,
    };
    request(opts, (err, res, body) => {
      if (err) {
        console.log("Ares: " + err);
        reject(err);
      }
      if (!err && (body === undefined || body === null)) {
        console.log("Ares: " + body);
        resolve("404");
      } else if (!err) {
        resolve(body);
      }
    });
  });
};

exports.getAsset = (assetUri) => {
  return new Promise(function (resolve, reject) {
    console.log(`Calling Ares API (CPS) for asset ${assetUri}`);
    const { cert, key, ca } = getTlsOptions();
    const opts = {
      cert: `${cert}`,
      key: `${key}`,
      passphrase: `${certPass}`,
      ca: `${ca}`,
      headers: {
        Accept: "application/json",
      },
      json: true,
      method: "GET",
      url: `https://ares-api.api.bbci.co.uk/api/asset/${assetUri}`,
    };
    request(opts, (err, res, body) => {
      if (err) {
        console.log("Ares: " + err);
      } else if (body === undefined || body === null) {
        console.log("Ares: " + body);
        resolve("404");
      } else if (body.status == 202) {
        resolve("202");
      } else {
        resolve(body);
        console.log(`Data for asset ${assetUri} has been extracted.`);
      }
    });
  });
};
