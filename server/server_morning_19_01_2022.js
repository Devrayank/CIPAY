import "@babel/polyfill";
import dotenv from "dotenv";
import "isomorphic-fetch";
import createShopifyAuth, { verifyRequest } from "@shopify/koa-shopify-auth";
import Shopify, { ApiVersion, DataType } from "@shopify/shopify-api";
import Koa from "koa";
import next from "next";
import Router from "koa-router";
import cors from 'koa-cors';
import koaBody from 'koa-bodyparser';
const axios = require('axios')

const { Pool, Client } = require('pg')
// const pool = new Pool({
//   user: "ahfaz",
//   host: "199.192.28.81", 
//   database: "ahfaz",
//   password: "4e/N0?cR_?k^4lv",
//   port: 5432,
// });

const pool = new Pool({
  user: "tis86",
  host: "127.0.0.1", 
  database: "tis86",
  password: "AdminTech@911",
  port: 5432,
});

// https://dirask.com/posts/Node-js-PostgreSQL-Create-table-if-not-exists-DZXJNj
// const execute = async (query) => {
//   try {
//       await pool.connect();     // gets connection
//       await pool.query(query);  // sends queries
//       return true;
//   } catch (error) {
//       console.error(error.stack);
//       return false;
//   } finally {
//       await pool.end();         // closes connection
//   }
// };

pool.connect(function(err) {
  if (err) throw err;
  console.log("Connected to DB!");

  pool.query("CREATE TABLE IF NOT EXISTS ciauth(id serial PRIMARY KEY, storeid VARCHAR ( 255 ) NOT NULL, authtoken VARCHAR ( 255 ) NOT NULL, storeorigin VARCHAR ( 100 ) NOT NULL)", (err, res) => {
    console.log('Create Executed');
  });

  pool.query("CREATE TABLE IF NOT EXISTS cigateway (id serial PRIMARY KEY, partnercode VARCHAR ( 255 ) NOT NULL, secretkey VARCHAR ( 255 ) NOT NULL, storeorigin VARCHAR ( 100 ) NOT NULL, paymentmode VARCHAR ( 10 ), UNIQUE(storeorigin), createddate TIMESTAMP NOT NULL, updateddate TIMESTAMP, status INT DEFAULT 0)", (err, res) => {
    console.log('Create CIpayment Table');
  });
});

dotenv.config();
const port = parseInt(process.env.PORT, 10) || 8081;
const dev = process.env.NODE_ENV !== "production";
const app = next({
  dev,
});
const handle = app.getRequestHandler();

Shopify.Context.initialize({
  API_KEY: process.env.SHOPIFY_API_KEY,
  API_SECRET_KEY: process.env.SHOPIFY_API_SECRET,
  SCOPES: process.env.SCOPES.split(","),
  HOST_NAME: process.env.HOST.replace(/https:\/\//, ""),
  API_VERSION: "2021-07",
  IS_EMBEDDED_APP: true,
  // This should be replaced with your preferred storage strategy
  SESSION_STORAGE: new Shopify.Session.MemorySessionStorage(),
});

// Storing the currently active shops in memory will force them to re-login when your server restarts. You should
// persist this object in your app.
const ACTIVE_SHOPIFY_SHOPS = {};
app.prepare().then(async () => {
  const server = new Koa();
  const router = new Router();
  server.keys = [Shopify.Context.API_SECRET_KEY];
  
  server.use(cors());

  server.use(
    createShopifyAuth({
      async afterAuth(ctx) {
        // Access token and shop available in ctx.state.shopify
        const { shop, accessToken, scope } = ctx.state.shopify;
        const host = ctx.query.host;
        ACTIVE_SHOPIFY_SHOPS[shop] = scope;

        const response = await Shopify.Webhooks.Registry.register({
          shop,
          accessToken,
          path: "/webhooks",
          topic: "APP_UNINSTALLED",
          webhookHandler: async (topic, shop, body) =>
            delete ACTIVE_SHOPIFY_SHOPS[shop],
        });

        if (!response.success) {
          console.log(
            `Failed to register APP_UNINSTALLED webhook: ${response.result}`
          );
        }

        // Redirect to app with shop parameter upon auth
        ctx.redirect(`/?shop=${shop}&host=${host}`);
      },
    })
  );

  const handleRequest = async (ctx) => {
    await handle(ctx.req, ctx.res);
    ctx.respond = false;
    ctx.res.statusCode = 200;
  };
  
  router.post("/webhooks", async (ctx) => {
    try {
      await Shopify.Webhooks.Registry.process(ctx.req, ctx.res);
      console.log(`Webhook processed, returned status code 200`);
    } catch (error) {
      console.log(`Failed to process webhook: ${error}`);
    }
  });

  router.post(
    "/graphql",
    verifyRequest({ returnHeader: true }),
    async (ctx, next) => {
      await Shopify.Utils.graphqlProxy(ctx.req, ctx.res);
    }
  );

  /**
   * Set Shopify Access Token into the Database and later use that Access Token to run Shopify APIs
   */
  router.get("/setAccessToken", async (ctx) => {
    console.log('access token calling');

    const session = await Shopify.Utils.loadCurrentSession(ctx.req, ctx.res);

    ctx.cookies.set('CIShopOrigin', session.shop, {
      httpOnly: false,
      secure: true,
      sameSite: 'none'
    });

    ctx.cookies.set('CIAccessToken', session.accessToken, {
      httpOnly: false,
      secure: true,
      sameSite: 'none'
    });

    let CIAccessToken = session.accessToken;
    let CIShopOrigin= session.shop;
    let storeid = "tis86";

    pool.query("INSERT INTO ciauth(storeid, authtoken, storeorigin) VALUES ('"+storeid+"', '"+CIAccessToken+"', '"+CIShopOrigin+"')", (err, res) => {
      console.log('Inserted');
    });
    

    // pool.query("SELECT id FROM ciauth WHERE storeid = '"+storeid +"'", function(err, result){
    //   pool.query("INSERT INTO ciauth(storeid, authtoken, storeorigin)VALUES('"+storeid+"', '"+CIAccessToken+"', '"+CIShopOrigin+"')",
    //     (err, res) => {
    //     console.log('Token registered into DB ');
    //   });

    //   if(result.rowCount == 0){
    //     pool.query("INSERT INTO ciauth(storeid, authtoken, storeorigin)VALUES('"+storeid+"', '"+CIAccessToken+"', '"+CIShopOrigin+"')",
    //       (err, res) => {
    //       console.log('Token registered into DB ');
    //     });   
    //   }else{  
    //     pool.query("UPDATE ciauth SET authtoken = '"+CIAccessToken+"' WHERE storeid = '"+storeid+"'", (err, res) => {
    //       // console.log(err, res);
    //     });
    //     console.log('Token updated ');
    //   }
    // });

    ctx.body = 'success';
    ctx.status = 200;
  });

  /**
   * Checkout API to Generate Checkout ID (token)
   */
  router.post("/CICheckout", koaBody(), async (ctx) => {

    if(!ctx.request.body) {
      ctx.body = [{'message': 'no items in the cart'}];
    }

    const lineItems = ctx.request.body;
    console.log('lineItems', lineItems);

    const result = await pool.query("SELECT authtoken FROM ciauth WHERE storeorigin = 'tisrr.myshopify.com' ORDER BY id DESC LIMIT 1");
    
    if (result || result.rows) {
      console.log('inside rows if');
      let authtoken = result.rows[0]['authtoken'];
      
      const client = new Shopify.Clients.Rest('tisrr.myshopify.com', authtoken);
      
      const checkoutdata = await client.post({
        path: 'checkouts',
        data: { "checkout":{
            "line_items": lineItems,
            "shipping_address": {
              "zip": "452010",
              "city": "Indore",
              "phone": "9752266711",
              "company": null,
              "country": "India",
              "address1": "Indore",
              "address2": "Indore",
              "province": "Madhya Pradesh",
              "last_name": "Jain",
              "first_name": "Gaurav",
              "country_code": "IND",
              "province_code": "MP"
            }
          }
        },
        type: DataType.JSON
      })      
      .then(data => {
        ctx.body = data;
        ctx.status = 200;  
      });
    } else {
      ctx.body = [{'message': 'You are not authorised!'}];
      ctx.status = 200;
    }
  });

  /**
   * Calculate Shipping by passing a Checkout token, so to run this route we will need a 
   * token which will be generated by CICheckout route means first we need to run checkout
   * API and generate token by passing line items and shipping address
   */
  router.get("/CalculateShipping/:object", async (ctx) => {
    console.log('Calculate Shipping', ctx.params.object);
    const shippingToken = ctx.params.object;

    const result = await pool.query("SELECT authtoken FROM ciauth WHERE storeorigin = 'tisrr.myshopify.com' ORDER BY id DESC LIMIT 1");
    
    if (result || result.rows) {
      let authtoken = result.rows[0]['authtoken'];
      
      const client = new Shopify.Clients.Rest('tisrr.myshopify.com', authtoken);

      const data = await client.get({
        path: 'checkouts/'+shippingToken+'/shipping_rates',
      })
      .then(data => {
        // console.log('Shipping data:', data);
        ctx.body = data;
        ctx.status = 200;
      });
    } else {
      ctx.body = [];
      ctx.status = 200;
    }
  });
  
  /**
   * Initiate Payment Gateway
   */
  router.post("/InitiatePayment", koaBody(), async (ctx) => {
        
    if(!ctx.request.body) {
      ctx.body = [{'message': 'no items in the cart'}];
      console.log('Payment is initiated', ctx.request.body);
    }
    
    const orderToken = ctx.request.body[0].token;
    const ordertotal = ctx.request.body[0].total;

    let PartnerCode = 'shopify-test';
    let secretKey = 'xiv1ibz7udg2hmg28f4pz2wphdegi84r9';
    let payloadString = "currencyType=INR|orderReference="+orderToken+"|txnAmount="+ordertotal+"";
    let reqURL = "https://demo.retail.cipay.inspirenetz.com/loyaltypg/public/payment/"+PartnerCode+"/initiate";
    
    const crypto = require('crypto');

    const hash = crypto.createHmac('sha256', secretKey)
                      .update(payloadString)
                      .digest('hex');

    var qs = require('qs');
    var payloadObject = qs.stringify({
      'orderReference': orderToken,
      'txnAmount': ordertotal,
      'currencyType': 'INR',
      'checkSum': hash
    });
    
    var config = {
      method: 'post',
      url: reqURL,
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: payloadObject
    };
    
    const res = await axios(config)
    .then(function (response) {
      return response.data;
    })
    .catch(function (error) {
      console.log('Payment Error');
      return error;
    });

    console.log('Payment Gateway Response Data', res);
    ctx.body = res;
    ctx.status = 200;
  });

  /**
   * Checkout API to Generate Checkout ID (token)
   */
  router.post("/CICheckout", koaBody(), async (ctx) => {

    if(!ctx.request.body) {
      ctx.body = [{'message': 'no items in the cart'}];
    }

    const lineItems = ctx.request.body;
    console.log('lineItems', lineItems);

    const result = await pool.query("SELECT authtoken FROM ciauth WHERE storeorigin = 'tisrr.myshopify.com' ORDER BY id DESC LIMIT 1");
    
    if (result || result.rows) {
      console.log('inside rows if');
      let authtoken = result.rows[0]['authtoken'];
      
      const client = new Shopify.Clients.Rest('tisrr.myshopify.com', authtoken);
      
      const checkoutdata = await client.post({
        path: 'checkouts',
        data: { "checkout":{
            "line_items": lineItems,
            "shipping_address": {
              "zip": "452010",
              "city": "Indore",
              "phone": "9752266711",
              "company": null,
              "country": "India",
              "address1": "Indore",
              "address2": "Indore",
              "province": "Madhya Pradesh",
              "last_name": "Jain",
              "first_name": "Gaurav",
              "country_code": "IND",
              "province_code": "MP"
            }
          }
        },
        type: DataType.JSON
      })      
      .then(data => {
        ctx.body = data;
        ctx.status = 200;  
      });
    } else {
      ctx.body = [{'message': 'You are not authorised!'}];
      ctx.status = 200;
    }
  });

  /**
   * Create Order API to create new order
   */
   router.post("/CIOrder", koaBody(), async (ctx) => {

    if(!ctx.request.body) {
      ctx.body = [{'message': 'no items in the cart'}];
    }

    const lineItems = ctx.request.body;
    console.log('lineItems', lineItems);

    const result = await pool.query("SELECT authtoken FROM ciauth WHERE storeorigin = 'tisrr.myshopify.com' ORDER BY id DESC LIMIT 1");
    
    if (result || result.rows) { 
      console.log('inside rows if');
      let authtoken = result.rows[0]['authtoken'];
      
      const client = new Shopify.Clients.Rest('tisrr.myshopify.com', authtoken);
      
      const orderdata = await client.post({
        path: 'orders',
        data: { "order":{
            "line_items": lineItems,
            "total_tax":14.45,
            "tags": "CIPay",
          }
        },
        type: DataType.JSON
      })      
      .then(data => {
        return data;        
      });

      ctx.body = orderdata;
      ctx.status = 200;
    } else {
      ctx.body = [{'message': 'You are not authorised!'}];
      ctx.status = 200;
    }
  });

  /**
   * Checkout API to Complete an Order
   */
  router.post("/CIComplete", koaBody(), async (ctx) => {

    if(!ctx.request.body) {
      ctx.body = [{'message': 'no items in the cart'}];
    }
    const orderToken = ctx.request.body[0].token;

    const result = await pool.query("SELECT authtoken FROM ciauth WHERE storeorigin = 'tisrr.myshopify.com' ORDER BY id DESC LIMIT 1");
    
    console.log('orderToken', orderToken);
    console.log('result', result);

    if (result || result.rows) {
      console.log('inside rows if');
      let authtoken = result.rows[0]['authtoken'];
      
      const client = new Shopify.Clients.Rest('tisrr.myshopify.com', authtoken);

      const checkoutdata = await client.post({
        path: 'checkouts/'+orderToken+'/complete',
        data: {},
        type: DataType.JSON
      })      
      .then(data => {
        ctx.body = data;
        ctx.status = 200;  
      });
    } else {
      ctx.body = [{'message': 'You are not authorised!'}];
      ctx.status = 200;
    }
  });

  /**
   * Save Payment gateway Setting
   */
   router.post("/PaymentGatewaySetting", koaBody(), async (ctx) => {
    console.log('PaymentGatewaySetting');

    ctx.body = 'PaymentGatewaySetting Working 1234 - ';
    ctx.status = 200;
  });

  /**
   * Just for Debug
   */
  router.post("/debug", koaBody(), async (ctx) => {
    console.log('debug');

    ctx.body = 'Debug Working 1234 - ';
    ctx.status = 200;
  });

  /**
   * Custom Route to fetch all products for Sales Channel 
   */
  router.get("/product_listings", async (ctx) => {
    console.log('product listing calling');

    const session = await Shopify.Utils.loadCurrentSession(ctx.req, ctx.res);
    
    // Create a new client for the specified shop.
    const client = new Shopify.Clients.Rest(session.shop, session.accessToken);
    // const client = new Shopify.Clients.Rest('tisrr.myshopify.com', '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');
    
    // Use `client.get` to request the specified Shopify REST API endpoint, in this case `products`.
    const product_listings = await client.get({
      path: 'product_listings',
    });

    ctx.body = product_listings;
    ctx.status = 200;
  });

  /**
   * Custom Route to fetch all products 
   */
  router.get("/products", async (ctx) => {
    console.log('products calling');
    const session = await Shopify.Utils.loadCurrentSession(ctx.req, ctx.res);
    
    // Create a new client for the specified shop.
    // const client = new Shopify.Clients.Rest('tisrr.myshopify.com', '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');
    const client = new Shopify.Clients.Rest(session.shop, session.accessToken);
    
    // Use `client.get` to request the specified Shopify REST API endpoint, in this case `products`.
    const products = await client.get({
      path: 'products',
    });

    ctx.body = products;
    ctx.status = 200;
  });

  router.get("(/_next/static/.*)", handleRequest); // Static content is clear
  router.get("/_next/webpack-hmr", handleRequest); // Webpack content is clear

  router.get("(.*)", async (ctx) => {
    const shop = ctx.query.shop;

    // This shop hasn't been seen yet, go through OAuth to create a session
    if (ACTIVE_SHOPIFY_SHOPS[shop] === undefined) {
      ctx.redirect(`/auth?shop=${shop}`);
    } else {
      await handleRequest(ctx);
    }
  });

  const corsOpts = {
    origin: '*',
  
    methods: [
      'GET',
      'POST',
    ],
  
    allowedHeaders: [
      'Content-Type',
    ],
  };

  /**
   * Cipayment start
   */
  router.post("/CIpayment", koaBody(), async (ctx) => {

    if(!ctx.request.body) {
      ctx.body = [{'message': 'no items in the cart'}];
    }
    let CIShopOrigin= "tisrr.myshopify.com";
    let partnercode= "TIS24";
    let secretkey= "DEV43543TIS";
    let paymentmode= "Dev";
    let dateTime = "2022-01-04";

    if(paymentmode=='Dev') {
      var status= "1";
    } else {
      var status= "0";
    }
    
    pool.query("SELECT id FROM cigateway WHERE storeorigin = '"+ CIShopOrigin +"' AND paymentmode = '"+ paymentmode +"'", function(err, result){
      if(result.rowCount == 0){
        pool.query("INSERT INTO cigateway(partnercode, secretkey, storeorigin, paymentmode, status, createddate)VALUES('"+partnercode+"', '"+secretkey+"', '"+CIShopOrigin+"', '"+paymentmode+"', '"+status+"', '"+dateTime+"')",
          (err, res) => {
            console.log('Inserted into DB ');
          }
        );
      } else {
        pool.query("UPDATE cigateway SET partnercode = '"+partnercode+"', secretkey = '"+secretkey+"', paymentmode = '"+paymentmode+"', updateddate = '"+dateTime+"', status = '"+status+"' WHERE storeorigin = '"+CIShopOrigin+"' AND paymentmode = '"+ paymentmode +"'", (err, res) => {
        
        });
        console.log('Updated into DB ');
        }
      }
    );
  });

  /**
   * Cipayment end
   */
  server.use(router.allowedMethods());
  server.use(cors(corsOpts));
  server.use(router.routes());
  server.use(koaBody());
  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});