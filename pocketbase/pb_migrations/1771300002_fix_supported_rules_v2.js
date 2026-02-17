/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("supported")

  collection.listRule = ""
  collection.viewRule = ""
  collection.createRule = ""
  collection.updateRule = ""
  collection.deleteRule = ""

  return app.save(collection)
}, (app) => {
  // no-op
})
