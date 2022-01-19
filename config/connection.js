const {Client} = require('pg');

const client = new Client({
    host: "162.0.232.113",
    user: "appciowi",
    port: 5432,
    password: "5x3GpJyJyDVE",
    database: "appciowi_CI_Checkout"
})

module.exports = client