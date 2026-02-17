/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1150480875")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_unique_plots_Plot_Id` ON `plots` (`Plot_Id`)"
    ]
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1150480875")

  // update collection data
  unmarshal({
    "indexes": []
  }, collection)

  return app.save(collection)
})
