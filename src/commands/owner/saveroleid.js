const base = require('./saveroleIDs');
const aliasData = {
    name: 'saveroleid',
    toJSON() {
        const json = base.data.toJSON();
        json.name = 'saveroleid';
        return json;
    }
};
module.exports = {
    data: aliasData,
    execute: base.execute
};