/**
 * PocketBase API Wrapper for PFFP
 * Provides Supabase-compatible API interface over PocketBase REST.
 * Drop-in replacement: script.js calls supabaseClient.from(...) methods unchanged.
 * 
 * FIELD MAPPING STRATEGY:
 * PocketBase stores all fields as lowercase_underscore.
 * script.js was written for Supabase which preserved original names (spaces, mixed case).
 * This wrapper translates between the two using explicit maps.
 */
var PB_URL = window.location.origin || "http://127.0.0.1:8090";

// ---- Table name mapping (Supabase table → PocketBase collection) ----
var PB_TABLE_MAP = {
    'users': 'app_users',       // PB built-in 'users' is auth collection
    'farmers': 'farmers',
    'plots': 'plots',
    'yearly_data': 'yearly_data',
    'supported': 'support',
    'admin': 'admin',
    'drop_values': 'drop_values',
    'species': 'species',
    'training_list': 'training_list',
    'op6_activities_list': 'op6_activities_list',
    'farmer_year': 'farmer_year',
    'survival_check': 'survival_check'
};

// ---- Supa→PB write maps (used when WRITING data to PocketBase) ----
// Maps "Supabase/script.js field name" → "PocketBase field name"
var PB_FIELD_MAP = {
    'farmers': {
        'Farmer_ID': 'farmer_id',
        'Full_Name': 'full_name',
        'Year_Of_Birth': 'year_of_birth',
        'Gender': 'gender',
        'Phone_Number': 'phone_number',
        'Farmer_Group_Name': 'farmer_group_name',
        'Village_Name': 'village_name',
        'Commune_Name': 'commune_name',
        'Address': 'address',
        'ID card': 'id_card',
        'Socioeconomic Status': 'socioeconomic_status',
        'Household Circumstances': 'household_circumstances',
        'Num_Household_Members': 'num_household_members',
        'Num_Working_Members': 'num_working_members',
        'Total_Coffee_Area': 'total_coffee_area',
        'Number of coffee farm plots': 'number_of_coffee_farm_plots',
        'Supported by': 'supported_by',
        'Manage by': 'manage_by',
        'Supported_Types': 'supported_types',
        'Participation Year': 'participation_year',
        'Staff input': 'staff_input',
        'Status': 'status',
        'Activity': 'activity',
        'Group_Code': 'group_code',
        'Total_Area_registered': 'total_area_registered',
        'Number Farm registered for support from': 'number_farm_registered_for_support_from'
    },
    'plots': {
        'Plot_Id': 'plot_id',
        'Plot_Name': 'plot_name',
        'Farmer_ID': 'farmer_id',
        'Area (ha)': 'area_ha',
        'Location': 'location',
        'Land use rights certificate?': 'land_use_rights_certificate',
        'Border_Natural_Forest': 'border_natural_forest',
        'Place name': 'place_name',
        'Num_Shade_Trees_Before': 'num_shade_trees_before',
        'Name_Shade_Trees_Before': 'name_shade_trees_before',
        'Num_Coffee_Trees': 'num_coffee_trees',
        'Coffee_Planted_Year': 'coffee_planted_year',
        'Receive seedlings from': 'receive_seedlings_from',
        'Farm registered for support from': 'farm_registered_for_support_from',
        'Notes for details (Optional)': 'notes_for_details',
        'Map Sheet': 'map_sheet',
        'Sub-mapsheet': 'sub_mapsheet',
        'Number of shade trees': 'number_of_shade_trees',
        'Number of shade tree species': 'number_of_shade_tree_species',
        'Status': 'status',
        'Activity': 'activity'
    },
    'yearly_data': {
        'Record_Id': 'record_id',
        'Farmer_ID': 'farmer_id',
        'Year': 'year',
        'Date': 'date',
        'Annual_Volume_Cherry': 'annual_volume_cherry',
        'Volume_High_Quality': 'volume_high_quality',
        'Total_Coffee_Income': 'total_coffee_income',
        'Supported_Types': 'supported_types',
        'Year_of_support': 'year_of_support',
        'Fertilizers_Applied': 'fertilizers_applied',
        'Name of fertilizer': 'name_of_fertilizer',
        'Fertilizer volume': 'fertilizer_volume',
        'Fertilizer cost': 'fertilizer_cost',
        'Pesticides_Applied': 'pesticides_applied',
        'Name of Pesticides': 'name_of_pesticides',
        'Pesticides volume': 'pesticides_volume',
        'Pesticides cost': 'pesticides_cost',
        'Herbicides_Applied': 'herbicides_applied',
        'Name of Herbicides': 'name_of_herbicides',
        'Herbicides volume': 'herbicides_volume',
        'Herbicides cost': 'herbicides_cost',
        'Hired_Labor_Costs': 'hired_labor_costs',
        'Other_Costs': 'other_costs',
        'Shade_Trees_supported by': 'shade_trees_supported_by',
        'Number_Shade_Trees_Planted': 'number_shade_trees_planted',
        'Shade_Trees_Species': 'shade_trees_species',
        'Year planted': 'year_planted',
        'Shade_Trees_Died': 'shade_trees_died',
        'Survival': 'survival_rate',
        'Fertiliser supported by WWF': 'fertiliser_by_wwf',
        'Lime supported by Slow': 'lime_from_slow',
        'Cover crop supported by Slow': 'cover_crop_from_slow',
        'Soil Test Support': 'soil_test_support',
        'Attending training capacity organized by PFFP': 'attending_training',
        'Op6_Activities': 'op6_activities',
        'Cherry sales registered to Slow': 'cherry_sales_registered_to_slow',
        'Cherry sales supplied to Slow': 'cherry_sales_supplied_to_slow',
        'Revenue from cherry sales to Slow (VND)': 'revenue_from_cherry_sales_to_slow',
        'Cherry bought by Slow via processor': 'cherry_slow_thru_processor',
        'Status': 'status',
        'Activity': 'activity'
    },
    'users': {
        'Staff ID': 'Staff_ID',
        'Full name': 'Full_name',
        'Organization': 'Organization',
        'Position': 'Position',
        'Gender': 'Gender',
        'Email': 'Email',
        'Phone': 'Phone',
        'Authority': 'Authority',
        'Status': 'Status',
        'View': 'View',
        'Rule': 'Rule',
        'Role': 'Role'
    },
    'op6_activities_list': {
        'OP6 ID': 'op6_id',
        'Name_EN': 'name_en',
        'Name_VI': 'name_vi',
        'Type': 'type',
        'From date': 'from_date',
        'To date': 'to_date'
    },
    'species': {
        'Species_ID': 'species_id',
        'Species_name': 'species_name',
        'Species type': 'species_type',
        'Species Info': 'species_info'
    },
    'admin': {
        'Adm_ID': 'adm_id',
        'Condition': 'condition',
        'Label EN': 'label_en',
        'Label VN': 'label_vn',
        'Notes': 'notes'
    },
    'supported': {
        'Support_ID': 'support_id',
        'Farmer_ID': 'farmer_id',
        'Plot_ID': 'plot_id',
        'Support_Type': 'support_type',
        'Species_Code': 'species_code',
        'Species_Name': 'species_name',
        'Date': 'date',
        'Quantity': 'quantity',
        'Unit': 'unit',
        'Note': 'note',
        'Staff_Input': 'staff_input',
        'A_live': 'a_live',
        'Program': 'program',
        'Year': 'year'
    },
    'drop_values': {
        'ID': 'code',
        'Condition': 'condition',
        'Label': 'label',
        'Label EN': 'label_en',
        'Label VN': 'label_vn'
    },
    'training_list': {
        'Train_ID': 'train_id',
        'Name_EN': 'name_en',
        'Name_VI': 'name_vi'
    },
    'survival_check': {
        'Check_ID': 'check_id',
        'Plot_ID': 'plot_id',
        'Species_Code': 'species_code',
        'Trees_Alive': 'trees_alive',
        'Survival_Rate': 'survival_rate',
        'Check_Round': 'check_round'
    }
};

// ---- Explicit PB→Supa REVERSE maps (used when READING data from PocketBase) ----
// Maps "PocketBase field name (lowercase)" → "script.js expected field name"
var PB_REVERSE_MAP = {
    'farmers': {
        'farmer_id': 'Farmer_ID',
        'full_name': 'Full_Name',
        'year_of_birth': 'Year_Of_Birth',
        'gender': 'Gender',
        'phone_number': 'Phone_Number',
        'farmer_group_name': 'Farmer_Group_Name',
        'village_name': 'Village_Name',
        'commune_name': 'Commune_Name',
        'address': 'Address',
        'id_card': 'ID card',
        'socioeconomic_status': 'Socioeconomic Status',
        'household_circumstances': 'Household Circumstances',
        'num_household_members': 'Num_Household_Members',
        'num_working_members': 'Num_Working_Members',
        'total_coffee_area': 'Total_Coffee_Area',
        'number_of_coffee_farm_plots': 'Number of coffee farm plots',
        'supported_by': 'Supported by',
        'manage_by': 'Manage by',
        'supported_types': 'Supported_Types',
        'participation_year': 'Participation Year',
        'staff_input': 'Staff input',
        'status': 'Status',
        'activity': 'Activity',
        'group_code': 'Group_Code',
        'cooperative_name': 'Cooperative_Name',
        'total_area_registered': 'Total Area registered',
        'number_farm_registered_for_support_from': 'Number Farm registered for support from',
        'year_of_support': 'Year_of_support',
        'ethnicity': 'Ethnicity'
    },
    'plots': {
        'plot_id': 'Plot_Id',
        'plot_name': 'Plot_Name',
        'farmer_id': 'Farmer_ID',
        'area_ha': 'Area (ha)',
        'location': 'Location',
        'land_use_rights_certificate': 'Land use rights certificate?',
        'border_natural_forest': 'Border_Natural_Forest',
        'place_name': 'Place name',
        'num_shade_trees_before': 'Num_Shade_Trees_Before',
        'name_shade_trees_before': 'Name_Shade_Trees_Before',
        'num_coffee_trees': 'Num_Coffee_Trees',
        'coffee_planted_year': 'Coffee_Planted_Year',
        'receive_seedlings_from': 'Receive seedlings from',
        'farm_registered_for_support_from': 'Farm registered for support from',
        'notes_for_details': 'Notes for details (Optional)',
        'map_sheet': 'Map Sheet',
        'sub_mapsheet': 'Sub-mapsheet',
        'number_of_shade_trees': 'Number of shade trees',
        'number_of_shade_tree_species': 'Number of shade tree species',
        'status': 'Status',
        'activity': 'Activity'
    },
    'yearly_data': {
        'record_id': 'Record_Id',
        'farmer_id': 'Farmer_ID',
        'year': 'Year',
        'date': 'Date',
        'update_info': 'Update_Info',
        'annual_volume_cherry': 'Annual_Volume_Cherry',
        'volume_high_quality': 'Volume_High_Quality',
        'total_coffee_income': 'Total_Coffee_Income',
        'supported_types': 'Supported_Types',
        'year_of_support': 'Year_of_support',
        'fertilizers_applied': 'Fertilizers_Applied',
        'name_of_fertilizer': 'Name of fertilizer',
        'fertilizer_volume': 'Fertilizer volume',
        'fertilizer_cost': 'Fertilizer cost',
        'pesticides_applied': 'Pesticides_Applied',
        'name_of_pesticides': 'Name of Pesticides',
        'pesticides_volume': 'Pesticides volume',
        'pesticides_cost': 'Pesticides cost',
        'herbicides_applied': 'Herbicides_Applied',
        'name_of_herbicides': 'Name of Herbicides',
        'herbicides_volume': 'Herbicides volume',
        'herbicides_cost': 'Herbicides cost',
        'hired_labor_costs': 'Hired_Labor_Costs',
        'other_costs': 'Other_Costs',
        'shade_trees_supported_by': 'Shade_Trees_supported by',
        'number_shade_trees_planted': 'Number_Shade_Trees_Planted',
        'shade_trees_species': 'Shade_Trees_Species',
        'year_planted': 'Year planted',
        'shade_trees_died': 'Shade_Trees_Died',
        'survival_rate': 'Survival',
        'fertiliser_by_wwf': 'Fertiliser supported by WWF',
        'lime_from_slow': 'Lime supported by Slow',
        'cover_crop_from_slow': 'Cover crop supported by Slow',
        'soil_test_support': 'Soil Test Support',
        'attending_training': 'Attending training capacity organized by PFFP',
        'op6_activities': 'Op6_Activities',
        'cherry_sales_registered_to_slow': 'Cherry sales registered to Slow',
        'cherry_sales_supplied_to_slow': 'Cherry sales supplied to Slow',
        'revenue_from_cherry_sales_to_slow': 'Revenue from cherry sales to Slow (VND)',
        'cherry_slow_thru_processor': 'Cherry bought by Slow via processor',
        'status': 'Status',
        'activity': 'Activity'
    },
    'users': {
        'Staff_ID': 'Staff ID',
        'Full_name': 'Full name',
        'Organization': 'Organization',
        'Position': 'Position',
        'Gender': 'Gender',
        'Email': 'Email',
        'Phone': 'Phone',
        'Authority': 'Authority',
        'Status': 'Status',
        'View': 'View',
        'Rule': 'Rule',
        'Role': 'Role'
    },
    'op6_activities_list': {
        'op6_id': 'OP6 ID',
        'name_en': 'Name_EN',
        'name_vi': 'Name_VI',
        'type': 'Type',
        'from_date': 'From date',
        'to_date': 'To date'
    },
    'species': {
        'species_id': 'Species_ID',
        'species_name': 'Species_name',
        'species_type': 'Species type',
        'species_info': 'Species Info'
    },
    'admin': {
        'adm_id': 'Adm_ID',
        'condition': 'Condition',
        'label_en': 'Label EN',
        'label_vn': 'Label VN',
        'notes': 'Notes',
        'label': 'Label'
    },
    'supported': {
        'support_id': 'Support_ID',
        'farmer_id': 'Farmer_ID',
        'plot_id': 'Plot_ID',
        'support_type': 'Support_Type',
        'species_code': 'Species_Code',
        'species_name': 'Species_Name',
        'date': 'Date',
        'quantity': 'Quantity',
        'unit': 'Unit',
        'note': 'Note',
        'staff_input': 'Staff_Input',
        'a_live': 'A_live',
        'program': 'Program',
        'year': 'Year'
    },
    'drop_values': {
        'code': 'ID',
        'condition': 'Condition',
        'label': 'Label',
        'label_en': 'Label EN',
        'label_vn': 'Label VN'
    },
    'training_list': {
        'train_id': 'Train_ID',
        'name_en': 'Name_EN',
        'name_vi': 'Name_VI'
    },
    'survival_check': {
        'check_id': 'Check_ID',
        'plot_id': 'Plot_ID',
        'species_code': 'Species_Code',
        'trees_alive': 'Trees_Alive',
        'survival_rate': 'Survival_Rate',
        'check_round': 'Check_Round'
    },
    'farmer_year': {
        'farmer_id': 'Farmer_ID',
        'program': 'Program',
        'year': 'Year',
        'status': 'Status',
        'enrollment_id': 'Enrollment_ID',
        'slo_classification': 'SLO_Classification'
    }
};

// ---- ID column mapping (Supabase idCol → PB field name) ----
var PB_ID_COL_MAP = {
    'Staff ID': 'staff_id',
    'OP6 ID': 'op6_id',
    'ID': 'code',
    'Farmer_ID': 'farmer_id',
    'Plot_Id': 'plot_id',
    'Record_Id': 'record_id',
    'Support_ID': 'support_id',
    'Species_ID': 'species_id',
    'Adm_ID': 'adm_id',
    'Train_ID': 'train_id'
};

// ---- Helpers ----
function pbCollection(supaTable) {
    return PB_TABLE_MAP[supaTable] || supaTable;
}

function supaToDb(table, record) {
    var map = PB_FIELD_MAP[table];
    if (!map) return Object.assign({}, record);
    var out = {};
    Object.keys(record).forEach(function (k) {
        var pbKey = map[k] || k.toLowerCase();
        out[pbKey] = record[k];
    });
    return out;
}

function pbToSupa(table, record) {
    if (!record) return record;
    var rmap = PB_REVERSE_MAP[table] || {};
    var out = {};
    Object.keys(record).forEach(function (k) {
        // Skip PocketBase internal fields
        if (k === 'id' || k === 'created' || k === 'updated' || k === 'collectionId' || k === 'collectionName') {
            return;
        }
        // Use explicit reverse map; fall back to key as-is if not mapped
        var supaKey = rmap[k];
        if (!supaKey) {
            // Fallback: keep original (shouldn't happen if maps are complete)
            supaKey = k;
            console.warn('[pbToSupa] Unmapped field in table "' + table + '": "' + k + '"');
        }
        out[supaKey] = record[k];
    });
    return out;
}

function pbIdCol(supaTable, supaIdCol) {
    return PB_ID_COL_MAP[supaIdCol] || supaIdCol.toLowerCase();
}

// Fetch all records from a PocketBase collection (handles pagination)
function pbFetchAll(collection, limit) {
    var perPage = Math.min(limit || 10000, 500);
    var allItems = [];
    function fetchPage(page) {
        return fetch(PB_URL + '/api/collections/' + collection + '/records?page=' + page + '&perPage=' + perPage + '&skipTotal=false')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.items) {
                    allItems = allItems.concat(data.items);
                    if (data.page < data.totalPages) {
                        return fetchPage(page + 1);
                    }
                }
                return allItems;
            });
    }
    return fetchPage(1);
}

// Find PB internal id by custom ID field value
function pbFindByField(collection, fieldName, fieldValue) {
    var filter = encodeURIComponent(fieldName + '="' + String(fieldValue).replace(/"/g, '\\"') + '"');
    return fetch(PB_URL + '/api/collections/' + collection + '/records?filter=' + filter + '&perPage=1')
        .then(function (r) { return r.json(); })
        .then(function (data) {
            return (data.items && data.items.length > 0) ? data.items[0] : null;
        });
}

// ---- Supabase-compatible Client ----
var supabaseClient = {
    from: function (tableName) {
        var collection = pbCollection(tableName);
        var supaTable = tableName;

        return {
            // SELECT
            select: function (cols) {
                var _limit = 10000;
                var builder = {
                    limit: function (n) { _limit = n; return builder; },
                    then: function (resolve, reject) {
                        return pbFetchAll(collection, _limit)
                            .then(function (items) {
                                var converted = items.map(function (item) { return pbToSupa(supaTable, item); });
                                resolve({ data: converted, error: null });
                            })
                            .catch(function (err) {
                                console.error('PB select error [' + collection + ']:', err);
                                if (reject) reject({ data: null, error: { message: String(err) } });
                                else resolve({ data: null, error: { message: String(err) } });
                            });
                    },
                    catch: function (fn) {
                        return builder.then(null, fn);
                    }
                };
                return builder;
            },

            // UPSERT (insert or update by conflict column)
            upsert: function (record, opts) {
                var conflictCol = (opts && opts.onConflict) || null;
                var pbConflict = conflictCol ? pbIdCol(supaTable, conflictCol) : null;
                var pbRecord = supaToDb(supaTable, record);
                var idValue = pbConflict ? pbRecord[pbConflict] : null;

                return {
                    then: function (resolve, reject) {
                        var doUpsert;
                        if (idValue && pbConflict) {
                            doUpsert = pbFindByField(collection, pbConflict, idValue)
                                .then(function (existing) {
                                    if (existing) {
                                        // UPDATE
                                        return fetch(PB_URL + '/api/collections/' + collection + '/records/' + existing.id, {
                                            method: 'PATCH',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify(pbRecord)
                                        });
                                    } else {
                                        // INSERT
                                        return fetch(PB_URL + '/api/collections/' + collection + '/records', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify(pbRecord)
                                        });
                                    }
                                });
                        } else {
                            doUpsert = fetch(PB_URL + '/api/collections/' + collection + '/records', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(pbRecord)
                            });
                        }

                        return doUpsert
                            .then(function (r) { return r.json(); })
                            .then(function (data) {
                                if (data.code && data.code >= 400) {
                                    resolve({ data: null, error: { message: data.message || 'Upsert failed' } });
                                } else {
                                    resolve({ data: pbToSupa(supaTable, data), error: null });
                                }
                            })
                            .catch(function (err) {
                                console.error('PB upsert error [' + collection + ']:', err);
                                if (reject) reject({ data: null, error: { message: String(err) } });
                                else resolve({ data: null, error: { message: String(err) } });
                            });
                    },
                    catch: function (fn) {
                        return this.then(null, fn);
                    }
                };
            },

            // INSERT
            insert: function (record) {
                var pbRecord = supaToDb(supaTable, record);
                return {
                    then: function (resolve, reject) {
                        return fetch(PB_URL + '/api/collections/' + collection + '/records', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(pbRecord)
                        })
                        .then(function (r) { return r.json(); })
                        .then(function (data) {
                            if (data.code && data.code >= 400) {
                                resolve({ data: null, error: { message: data.message || 'Insert failed' } });
                            } else {
                                resolve({ data: pbToSupa(supaTable, data), error: null });
                            }
                        })
                        .catch(function (err) {
                            console.error('PB insert error [' + collection + ']:', err);
                            if (reject) reject({ data: null, error: { message: String(err) } });
                            else resolve({ data: null, error: { message: String(err) } });
                        });
                    },
                    catch: function (fn) {
                        return this.then(null, fn);
                    }
                };
            },

            // DELETE (chained: .delete().eq(col, val))
            delete: function () {
                return {
                    eq: function (col, val) {
                        var pbCol = pbIdCol(supaTable, col);
                        // Also check write field map
                        if (PB_FIELD_MAP[supaTable] && PB_FIELD_MAP[supaTable][col]) {
                            pbCol = PB_FIELD_MAP[supaTable][col];
                        }
                        return {
                            then: function (resolve, reject) {
                                return pbFindByField(collection, pbCol, val)
                                    .then(function (existing) {
                                        if (!existing) {
                                            resolve({ data: null, error: { message: 'Record not found: ' + col + '=' + val } });
                                            return;
                                        }
                                        return fetch(PB_URL + '/api/collections/' + collection + '/records/' + existing.id, {
                                            method: 'DELETE'
                                        }).then(function (r) {
                                            if (r.ok || r.status === 204) {
                                                resolve({ data: null, error: null });
                                            } else {
                                                return r.json().then(function (d) {
                                                    resolve({ data: null, error: { message: d.message || 'Delete failed' } });
                                                });
                                            }
                                        });
                                    })
                                    .catch(function (err) {
                                        console.error('PB delete error [' + collection + ']:', err);
                                        if (reject) reject({ data: null, error: { message: String(err) } });
                                        else resolve({ data: null, error: { message: String(err) } });
                                    });
                            },
                            catch: function (fn) {
                                return this.then(null, fn);
                            }
                        };
                    }
                };
            },

            // UPDATE (chained: .update(data).eq(col, val))
            update: function (updateData) {
                var pbUpdateData = supaToDb(supaTable, updateData);
                return {
                    eq: function (col, val) {
                        var pbCol = pbIdCol(supaTable, col);
                        if (PB_FIELD_MAP[supaTable] && PB_FIELD_MAP[supaTable][col]) {
                            pbCol = PB_FIELD_MAP[supaTable][col];
                        }
                        return {
                            then: function (resolve, reject) {
                                return pbFindByField(collection, pbCol, val)
                                    .then(function (existing) {
                                        if (!existing) {
                                            resolve({ data: null, error: { message: 'Record not found: ' + col + '=' + val } });
                                            return;
                                        }
                                        return fetch(PB_URL + '/api/collections/' + collection + '/records/' + existing.id, {
                                            method: 'PATCH',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify(pbUpdateData)
                                        })
                                        .then(function (r) { return r.json(); })
                                        .then(function (data) {
                                            if (data.code && data.code >= 400) {
                                                resolve({ data: null, error: { message: data.message || 'Update failed' } });
                                            } else {
                                                resolve({ data: pbToSupa(supaTable, data), error: null });
                                            }
                                        });
                                    })
                                    .catch(function (err) {
                                        console.error('PB update error [' + collection + ']:', err);
                                        if (reject) reject({ data: null, error: { message: String(err) } });
                                        else resolve({ data: null, error: { message: String(err) } });
                                    });
                            },
                            catch: function (fn) {
                                return this.then(null, fn);
                            }
                        };
                    }
                };
            }
        };
    }
};

console.log('PocketBase wrapper loaded. Backend:', PB_URL);
