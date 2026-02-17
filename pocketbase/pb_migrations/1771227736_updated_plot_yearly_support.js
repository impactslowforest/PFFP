/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_965339583")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_unique_plot_yearly_support_Support_ID` ON `plot_yearly_support` (`Support_ID`)"
    ]
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_965339583")

  // update collection data
  unmarshal({
    "indexes": []
  }, collection)

  return app.save(collection)
})
