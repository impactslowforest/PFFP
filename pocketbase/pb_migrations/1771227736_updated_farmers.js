/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_4155943932")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_unique_farmers_Farmer_ID` ON `farmers` (`Farmer_ID`)"
    ]
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_4155943932")

  // update collection data
  unmarshal({
    "indexes": []
  }, collection)

  return app.save(collection)
})
