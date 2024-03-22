const Mongo = require("./helpers/mongoDb_async")

Mongo.writeToMongoExtended(

  {
    "urn" : "urn:bbc:ares::article:c72key7z4j3o",
    "action" : "Updated",
    "passport" : {
      "language" : "es",
      "home" : "http://www.bbc.co.uk/ontologies/passport/home/Gahuza",
      "locator" : "urn:bbc:optimo:asset:c72key7z4j3o",
      "availability" : "AVAILABLE",
      "taggings" : [ {
        "predicate" : "http://www.bbc.co.uk/ontologies/creativework/about",
        "value" : "http://www.bbc.co.uk/things/f4c04551-e7a2-460a-bac7-eee6c6a7edcf#id"
      }, {
        "predicate" : "http://www.bbc.co.uk/ontologies/audience/motivation",
        "value" : "http://www.bbc.co.uk/things/bf928ac3-b3bd-4d47-924e-cca1bdc29174#id"
      }, {
        "predicate" : "http://www.bbc.co.uk/ontologies/creativework/about",
        "value" : "http://www.bbc.co.uk/things/e0d04166-b92f-468e-9e68-d5f9330e6ae7#id"
      }, {
        "predicate" : "http://www.bbc.co.uk/ontologies/creativework/format",
        "value" : "http://www.bbc.co.uk/things/c31d108c-f7bc-43bf-8b3d-83f0114844ec#id"
      }, {
        "predicate" : "http://www.bbc.co.uk/ontologies/bbc/infoClass",
        "value" : "http://www.bbc.co.uk/things/0db2b959-cbf8-4661-965f-050974a69bb5#id"
      }, {
        "predicate" : "http://www.bbc.co.uk/ontologies/creativework/about",
        "value" : "http://www.bbc.co.uk/things/8a9d5e78-6caf-44a7-8564-34e9319ecb23#id"
      }, {
        "predicate" : "http://www.bbc.co.uk/ontologies/bbc/assetType",
        "value" : "http://www.bbc.co.uk/things/22ea958e-2004-4f34-80a7-bf5acad52f6f#id"
      }, {
        "predicate" : "http://www.bbc.co.uk/ontologies/creativework/about",
        "value" : "http://www.bbc.co.uk/things/f0e68d01-22ae-42a7-9e05-d299a29d4ce5#id"
      }, {
        "predicate" : "http://www.bbc.co.uk/ontologies/creativework/about",
        "value" : "http://www.bbc.co.uk/things/03460c2c-34b5-4681-ba1f-6d5aa1d2659e#id"
      } ],
      "schemaVersion" : "1.4.0",
      "publishedState" : "PUBLISHED"
    },
    "url" : "https://ares-api.api.bbci.co.uk/api/article/c72key7z4j3o",
    "assetType" : "article",
    "locators" : {
      "optimoUrn" : "urn:bbc:optimo:asset:c72key7z4j3o",
      "canonicalUrl" : "https://www.bbc.com/mundo/articles/c72key7z4j3o"
    },
    "cmsNotificationTimestamp" : 1709935125000,
    "trackingId" : "5a30cd31-29aa-4438-ad66-cf8328fc0195"
  }

  
).then(data => console.log(data))