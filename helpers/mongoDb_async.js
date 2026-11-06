const MongoClient = require("mongodb").MongoClient;
const dotenv = require("dotenv");
const ares = require("./ares");
dotenv.config();
const connectionString = `mongodb+srv://${process.env["MONGO_DB_USERNAME"]}:${process.env["MONGO_DB_PASSWORD"]}@cluster0.aaxi8.mongodb.net/?retryWrites=true&w=majority`;
let aresDataCanonicalUrlIndexPromise;

const ensureAresDataCanonicalUrlIndex = (collection) => {
  if (!aresDataCanonicalUrlIndexPromise) {
    aresDataCanonicalUrlIndexPromise = collection
      .createIndex(
        { "metadata.locators.canonicalUrl": 1 },
        {
          name: "unique_aresData_canonicalUrl",
          unique: true,
          partialFilterExpression: {
            "metadata.locators.canonicalUrl": { $type: "string" },
          },
        },
      )
      .catch((error) => {
        aresDataCanonicalUrlIndexPromise = undefined;
        throw error;
      });
  }

  return aresDataCanonicalUrlIndexPromise;
};

const rejectEmptyArticlesJson = (document) => {
  if (
    Array.isArray(document?.articlesJson) &&
    document.articlesJson.length === 0
  ) {
    throw new Error("Refusing to write a document with empty articlesJson");
  }
};

const isFirstPublishedBefore = (input, cutoff) => ({
  $let: {
    vars: {
      firstPublished: {
        $convert: {
          input,
          to: "date",
          onError: null,
          onNull: null,
        },
      },
    },
    in: {
      $and: [
        { $ne: ["$$firstPublished", null] },
        { $lt: ["$$firstPublished", cutoff] },
      ],
    },
  },
});

exports.writeToMongo = async (document) => {
  rejectEmptyArticlesJson(document);
  let client = await MongoClient.connect(connectionString);

  let db = client.db("WorldServiceData");
  try {
    await db.collection("latest").insertOne(document);

    console.log(`Data packet sent`);
  } finally {
    client.close();
  }
};

exports.writeToMongoExtended = async (document) => {
  rejectEmptyArticlesJson(document);
  const articleId = ares.extractArticleId(document.urn);
  const rawArticle = await ares.getArticle(articleId);
  if (
    !rawArticle ||
    rawArticle === "404" ||
    typeof rawArticle !== "object" ||
    Array.isArray(rawArticle)
  ) {
    throw new Error(
      `ARES returned an invalid article response for ${articleId}`,
    );
  }

  const enrichedDocument = await ares.enrichDocument(document, rawArticle);
  console.log("Enriched ARES fields:", {
    canonicalUrl: enrichedDocument.metadata?.locators?.canonicalUrl,
    createdBy: enrichedDocument.metadata?.createdBy,
    language: enrichedDocument.metadata?.language,
    consumableAsSFV: enrichedDocument.consumableAsSFV,
    seoHeadline: enrichedDocument.promo?.headlines?.seoHeadline,
    imageLocator:
      enrichedDocument.promo?.images?.defaultPromoImage?.model?.locator,
  });
  let client = await MongoClient.connect(connectionString);

  let db = client.db("WorldServiceData");
  try {
    const rawCollection = db.collection("aresRaw");
    const cueCanonicalUrl =
      document.metadata?.locators?.canonicalUrl ||
      document.locators?.canonicalUrl;
    const rawCanonicalUrl =
      rawArticle.metadata?.locators?.canonicalUrl ||
      rawArticle.locators?.canonicalUrl;

    if (typeof cueCanonicalUrl !== "string" || cueCanonicalUrl.length === 0) {
      console.error(
        `Skipping raw ARES article ${articleId}: queue notification has no canonical URL`,
      );
    } else if (
      typeof rawCanonicalUrl !== "string" ||
      rawCanonicalUrl.length === 0
    ) {
      console.error(
        `Skipping raw ARES article ${articleId}: ARES response has no canonical URL`,
      );
    } else if (rawCanonicalUrl !== cueCanonicalUrl) {
      console.error(
        `Skipping raw ARES article ${articleId}: queue and ARES canonical URLs do not match`,
      );
    } else {
      const existingRawArticle = await rawCollection.findOne({
        $or: [
          { "metadata.locators.canonicalUrl": cueCanonicalUrl },
          { "locators.canonicalUrl": cueCanonicalUrl },
        ],
      });

      if (existingRawArticle) {
        console.log(
          `Raw ARES article ${articleId} skipped: canonical URL already exists`,
        );
      } else {
        await rawCollection.insertOne(rawArticle);
        console.log(`Raw ARES article ${articleId} uploaded`);
      }
    }

    const aresDataCollection = db.collection("aresData");
    const canonicalUrl =
      rawArticle.metadata?.locators?.canonicalUrl ||
      rawArticle.locators?.canonicalUrl ||
      enrichedDocument.metadata?.locators?.canonicalUrl ||
      enrichedDocument.locators?.canonicalUrl;
    if (typeof canonicalUrl === "string" && canonicalUrl.length > 0) {
      enrichedDocument.metadata = {
        ...enrichedDocument.metadata,
        locators: {
          ...enrichedDocument.metadata?.locators,
          canonicalUrl,
        },
      };
      await ensureAresDataCanonicalUrlIndex(aresDataCollection);
    }

    let storedDocument;

    if (typeof canonicalUrl === "string" && canonicalUrl.length > 0) {
      const existingDocument = await aresDataCollection.findOne(
        {
          $or: [
            { "metadata.locators.canonicalUrl": canonicalUrl },
            { "locators.canonicalUrl": canonicalUrl },
          ],
        },
        { projection: { _id: 1 } },
      );

      if (existingDocument) {
        await aresDataCollection.replaceOne(
          { _id: existingDocument._id },
          enrichedDocument,
        );
        storedDocument = existingDocument;
        console.log(`Document with canonical URL updated`);
      } else {
        const result = await aresDataCollection.insertOne(enrichedDocument);
        storedDocument = { _id: result.insertedId };
        console.log(`New document uploaded`);
      }
    } else {
      const existingDocument = await aresDataCollection.findOne(
        { urn: enrichedDocument.urn },
        { projection: { _id: 1 } },
      );

      if (existingDocument) {
        await aresDataCollection.replaceOne(
          { _id: existingDocument._id },
          enrichedDocument,
        );
        storedDocument = existingDocument;
      } else {
        const result = await aresDataCollection.insertOne(enrichedDocument);
        storedDocument = { _id: result.insertedId };
        console.log(`New document uploaded`);
      }
    }

    //log document

    const cmsDate = new Date(
      enrichedDocument.cmsNotificationTimestamp,
    ).toLocaleDateString("en-UK");
    const mongoInputDate = new Date(
      storedDocument._id.getTimestamp(),
    ).toLocaleDateString("en-GB");
    // const todayDate = new Date().toLocaleDateString('en-UK');

    if (enrichedDocument.action === "Published" && cmsDate === mongoInputDate) {
      //check if there are any documents counted under the document's date

      const checkDate = await db
        .collection("aresReports")
        .countDocuments({ date: cmsDate }, { limit: 1 });

      if (checkDate === 0) {
        //if there are no documents counted under the document's date, create a new entry
        await db.collection("aresReports").insertOne({
          date: cmsDate,
          serviceStatus: [{ home: enrichedDocument.passport.home, count: 1 }],
        });
        console.log(`An entry for ${cmsDate} has been added to the logs`);
      } else {
        const target = await db
          .collection("aresReports")
          .findOne({ date: cmsDate });
        //if there are documents counted under the document's date, for this service, increment the count
        if (
          target.serviceStatus
            .map((x) => x.home)
            .includes(enrichedDocument.passport.home)
        ) {
          await db.collection("aresReports").updateOne(
            {
              date: cmsDate,
              "serviceStatus.home": enrichedDocument.passport.home,
            },
            { $inc: { "serviceStatus.$.count": 1 } },
          );
          console.log(`An entry for ${cmsDate} has been incremented`);
        } else {
          await db.collection("aresReports").updateOne(
            { date: cmsDate },
            {
              $push: {
                serviceStatus: {
                  home: enrichedDocument.passport.home,
                  count: 1,
                },
              },
            },
          );
        }

        console.log(
          `Service ${enrichedDocument.passport.home} has been added to ${cmsDate}`,
        );
      }
    }
    //end of document log
  } finally {
    client.close();
  }
};

exports.cleanOldAresArticles = async (now = new Date()) => {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError("Cleanup time must be a valid Date");
  }

  const cutoff = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

  const client = await MongoClient.connect(connectionString);
  try {
    const db = client.db("WorldServiceData");
    const olderThanCutoff = {
      $expr: isFirstPublishedBefore("$metadata.firstPublished", cutoff),
    };

    const rawResult = await db
      .collection("aresRaw")
      .deleteMany(olderThanCutoff);
    const dataResult = await db
      .collection("aresData")
      .deleteMany(olderThanCutoff);
    const latestCollection = db.collection("latest");
    const expiredLatestArticle = isFirstPublishedBefore(
      "$$article.metadata.firstPublished",
      cutoff,
    );
    const latestResult = await latestCollection.updateMany(
      {
        articlesJson: { $type: "array" },
        $expr: {
          $gt: [
            {
              $size: {
                $filter: {
                  input: "$articlesJson",
                  as: "article",
                  cond: expiredLatestArticle,
                },
              },
            },
            0,
          ],
        },
      },
      [
        {
          $set: {
            articlesJson: {
              $filter: {
                input: "$articlesJson",
                as: "article",
                cond: { $not: [expiredLatestArticle] },
              },
            },
          },
        },
      ],
    );
    const emptyLatestResult = await latestCollection.deleteMany({
      articlesJson: { $size: 0 },
    });

    console.log(
      `Removed ${rawResult.deletedCount} old documents from aresRaw and ${dataResult.deletedCount} from aresData; trimmed expired articles from ${latestResult.modifiedCount} latest documents and removed ${emptyLatestResult.deletedCount} empty latest documents (before ${cutoff.toISOString()})`,
    );
    return {
      aresRaw: rawResult.deletedCount,
      aresData: dataResult.deletedCount,
      latestDocumentsUpdated: latestResult.modifiedCount,
      latestDocumentsDeleted: emptyLatestResult.deletedCount,
    };
  } finally {
    await client.close();
  }
};

exports.cleanMongo = async (document) => {
  let client = await MongoClient.connect(connectionString);

  let db = client.db("WorldServiceData");
  try {
    if (document[0]) {
      if (document[0].relatedContent) {
        console.log("relatedContent found");
        if (document[0].relatedContent.site) {
          console.log("site found");
          if (document[0].relatedContent.site.uri) {
            console.log("uri found");

            const uri = document[0].relatedContent.site.uri;
            await db
              .collection("latest")
              .deleteMany({ "articlesJson.relatedContent.site.uri": uri });
          }
        }
      }
    }
    console.log(`Cleanup complete`);
  } finally {
    client.close();
  }
};

exports.removeEmptyMongo = async () => {
  let client = await MongoClient.connect(connectionString);

  let db = client.db("WorldServiceData");
  try {
    await db.collection("latest").deleteMany({ articlesJson: [] });

    console.log(`Empty arrays have been removed.`);
  } finally {
    client.close();
  }
};
