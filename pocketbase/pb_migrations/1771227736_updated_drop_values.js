/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_4172646777")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_unique_drop_values_Code` ON `drop_values` (`Code`)"
    ]
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_4172646777")

  // update collection data
  unmarshal({
    "indexes": []
  }, collection)

  return app.save(collection)
})
