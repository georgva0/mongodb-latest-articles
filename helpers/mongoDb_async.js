const MongoClient = require("mongodb").MongoClient;
const dotenv = require("dotenv");
dotenv.config();
const connectionString = `mongodb+srv://${process.env["MONGO_DB_USERNAME"]}:${process.env["MONGO_DB_PASSWORD"]}@cluster0.aaxi8.mongodb.net/?retryWrites=true&w=majority`;

exports.writeToMongo = async (document) => {
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
  let client = await MongoClient.connect(connectionString);

  let db = client.db("WorldServiceData");
  try {

    //log document
    if(document.action === "Published"){
      //check if there are any documents counted under the document's date
      const cmsDate = new Date(document.cmsNotificationTimestamp).toLocaleDateString('en-UK');
      const checkDate = await db.collection("aresReports").countDocuments({date:cmsDate}, { limit: 1 });

      if (checkDate === 0){
        //if there are no documents counted under the document's date, create a new document
        await db.collection("aresReports").insertOne({date:cmsDate, serviceStatus:[{home:document.passport.home, count:1}]});
        console.log(`An entry for ${cmsDate} has been created in the logs`)
      }  
      
      else {
        const target = await db.collection("aresReports").findOne({date:cmsDate});
        //if there are documents counted under the document's date, for this service, increment the count
        if (target.serviceStatus.map(x => x.home).includes(document.passport.home)){
          await db.collection("aresReports").updateOne({date:cmsDate, "serviceStatus.home":document.passport.home }, {$inc: {"serviceStatus.$.count":1}});
          console.log(`An entry for ${cmsDate} has been incremented`)
        } else {
          await db.collection("aresReports").updateOne({date:cmsDate}, {$push: {"serviceStatus":{home:document.passport.home, count:1}}} )
        }

        console.log(`Service ${document.passport.home} has been added to ${cmsDate}`)

      }
    }
    //end of document log
    
    const check = await db.collection("aresData").countDocuments({urn:document.urn}, { limit: 1 });

    if (check === 0){
      await db.collection("aresData").insertOne(document);
      console.log(`New document uploaded`);
    } else {
      await db.collection("aresData").replaceOne({urn:document.urn}, document);
      console.log(`Document updated`);
    }

    //purge older documents
    const updatedCollection = await db.collection("aresData").find({"passport.language":document.passport.language}).sort({cmsNotificationTimestamp:-1}).toArray();

    const itemsToDelete = updatedCollection.slice(30);

    await db.collection("aresData").deleteMany({ _id: { $in: itemsToDelete.map(v => v._id) } });
  
    console.log(`Purged ${itemsToDelete.length} documents`);  
    
  } finally {
    client.close();
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
