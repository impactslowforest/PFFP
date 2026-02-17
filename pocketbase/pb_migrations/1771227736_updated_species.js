/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_878479608")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_unique_species_Species_ID` ON `species` (`Species_ID`)"
    ]
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_878479608")

  // update collection data
  unmarshal({
    "indexes": []
  }, collection)

  return app.save(collection)
})
