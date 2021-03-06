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
const date = require('date-and-time')


const { Pool, Client } = require('pg');

const pool = new Pool({
  user: "tis24",
  host: "127.0.0.1",
  database: "tis24",
  password: "TechAdmin",
  port: 5432,
});

pool.connect(function (err) {
  if (err) throw err;
  console.log("Connected to DB!");

  pool.query("CREATE TABLE IF NOT EXISTS ciauth(id serial PRIMARY KEY, storeid VARCHAR ( 255 ) NOT NULL, authtoken VARCHAR ( 255 ) NOT NULL, storeorigin VARCHAR ( 100 ) NOT NULL)", (err, res) => {
    console.log('Create Executed');
  });

  pool.query("CREATE TABLE IF NOT EXISTS cigateway (id serial PRIMARY KEY, partnercode VARCHAR ( 255 ) NOT NULL, secretkey VARCHAR ( 255 ) NOT NULL, storeorigin VARCHAR ( 255 ) NOT NULL, paymentmode VARCHAR ( 255 ), createddate TIMESTAMP NOT NULL, updateddate TIMESTAMP, status INT DEFAULT 0)", (err, res) => {
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

    console.log("Failed to register APP_UNINSTALLED webhook ********************** ", response.success);

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
    let CIShopOrigin = session.shop;
    let storeid = "tis86";

    pool.query("INSERT INTO ciauth(storeid, authtoken, storeorigin) VALUES ('" + storeid + "', '" + CIAccessToken + "', '" + CIShopOrigin + "')", (err, res) => {
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
   * Calculate Shipping by passing a Checkout token, so to run this route we will need a 
   * token which will be generated by CICheckout route means first we need to run checkout
   * API and generate token by passing line items and shipping address
   */
  router.get("/CalculateShipping/:object", async (ctx) => {
    console.log('Calculate Shipping', ctx.params.object);
    const shippingToken = ctx.params.object;    

    const result = await pool.query("SELECT authtoken FROM ciauth WHERE storeorigin = '"+process.env.SHOP+"' ORDER BY id DESC LIMIT 1");
    if (result || result.rows) {
      let authtoken = result.rows[0]['authtoken'];

      console.log('authtoken ====================== ', authtoken);


      const client = new Shopify.Clients.Rest(process.env.SHOP, authtoken);
      const data = await client.get({
        path: 'checkouts/' + shippingToken + '/shipping_rates',
      })
        .then(data => {
          ctx.body = data;
          ctx.status = 200;
        });
    } else {
      ctx.body = [];
      ctx.status = 200;
    }
  });


  /**
   * retrieves a checkouts
   */

    router.get("/retrievescheckout/:object", async (ctx) => {
      console.log('Get details Shipping', ctx.params.object);
      const shippingToken = ctx.params.object;   

    // if (!ctx.request.body) {
    //   ctx.body = [{ 'message': 'no items in the cart' }];
    //   console.log('Payment is initiated', ctx.request.body);
    // }

     const Checkout_token = ctx.params.object;
   // const Checkout_token = '66f30e64bb7a15ebce1503c9217216b3';


   console.log('Get <<<<<<<<<<<<< ++++++++++++++++++++++++++++++++  ',Checkout_token);

    const result = await pool.query("SELECT authtoken FROM ciauth WHERE storeorigin = '"+process.env.SHOP+"' ORDER BY id DESC LIMIT 1");
    if (result || result.rows) {
      let authtoken = result.rows[0]['authtoken'];


      const client = new Shopify.Clients.Rest(process.env.SHOP, authtoken);
      const dataret = await client.get({
        path: 'checkouts/'+Checkout_token,
      })
        .then(data => {
          ctx.body = data;
          ctx.status = 200;
          console.log("Checkout get >>>>>>>>>>>>>>>>>>>", dataret);
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

    if (!ctx.request.body) {
      ctx.body = [{ 'message': 'no items in the cart' }];
      console.log('Payment is initiated', ctx.request.body);
    }

    const orderToken = ctx.request.body[0].token;
    const ordertotal = ctx.request.body[0].total;

    let PartnerCode = 'shopify-test';
    let secretKey = 'xiv1ibz7udg2hmg28f4pz2wphdegi84r9';
    let payloadString = "currencyType=INR|orderReference=" + orderToken + "|txnAmount=" + ordertotal + "";
    let reqURL = "https://demo.retail.cipay.inspirenetz.com/loyaltypg/public/payment/" + PartnerCode + "/initiate";

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

    if (!ctx.request.body) {
      ctx.body = [{ 'message': 'no items in the cart' }];
    }
    const checkoutData1 = ctx.request.body;
    const lineItems = checkoutData1.line_items;

    console.log("checkoutData1 >>>>>>>>>>>>>>>>>>>>>>>> ", checkoutData1);


    const result = await pool.query("SELECT authtoken FROM ciauth WHERE storeorigin = '"+process.env.SHOP+"' ORDER BY id DESC LIMIT 1");

    if (result || result.rows) {
      console.log('inside rows if');
      let authtoken = result.rows[0]['authtoken'];


      const client = new Shopify.Clients.Rest(process.env.SHOP, authtoken);
      const checkoutdata = await client.post({
        path: 'checkouts',
        data: checkoutData1,        
        type: DataType.JSON
      })
      .then(data => {
        ctx.body = data;
        ctx.status = 200;
       // console.log('Checkout  created ststics >>>>>>>>>>>>>>>> ', [checkoutdata]);
      });
    } else {
      ctx.body = [{ 'message': 'You are not authorised!' }];
      ctx.status = 200;
    }
   
  });


 
  /**
   * Create Order API to create new order
   */
  router.post("/CIOrder", koaBody(), async (ctx) => {

    if (!ctx.request.body) {
      ctx.body = [{ 'message': 'no items in the cart' }];
    }

    const lineItems = ctx.request.body.order.lineitems;
    const tags = ctx.request.body.order.tags;
    const tax_lines = ctx.request.body.order.tax_lines;
    const current_total_tax = ctx.request.body.order.current_total_tax;
    const shipping_address = ctx.request.body.order.shipping_address;
    const phone = ctx.request.body.order.shipping_address.phone;
    const total_shipping_price_set = ctx.request.body.order.total_shipping_price_set;

    console.log('oder dtl     >>>>>>>>>>>>>>>>>  ', ctx.request.body.order);
    // console.log('shipp >>>>>>>>>>>>>>>***************** ++++++++++++++++ ', total_shipping_price_set);
   // console.log('oder detailsssssssssssss  =====   >>>>>>>>>>>>>>>>>  ', ctx.request.body.order);
    const result = await pool.query("SELECT authtoken FROM ciauth WHERE storeorigin = '"+process.env.SHOP+"' ORDER BY id DESC LIMIT 1");

    if (result || result.rows) {
      console.log('inside rows if');
      let authtoken = result.rows[0]['authtoken'];

      const client = new Shopify.Clients.Rest(process.env.SHOP, authtoken);

      const orderdata = await client.post({
        path: 'orders',
        data: {
             "order":ctx.request.body.order
        // {
        //   "order": {
        //     "line_items": lineItems,
        //     "total_tax": current_total_tax,
        //     "tags": tags,
        //     "tax_lines": tax_lines,
        //     "contact_email": "gauravjainse@gmail.com",
        //     "phone": phone,
        //     "shipping_address": shipping_address,
        //     "total_shipping_price_set": total_shipping_price_set
    
        //   }
        // }
        }
        ,
        type: DataType.JSON
      })
        .then(data => {
          return data;
        });

      ctx.body = orderdata;
      ctx.status = 200;
      console.log('orderdata  created Data return <<<<<<<<<<< +++++++++++++++++++++++++++ >>>>>>>>>>>>>>>> ', orderdata);
    } else {
      ctx.body = [{ 'message': 'You are not authorised!' }];
      ctx.status = 200;
    }
  });

  /**
   * Checkout API to Complete an Order
   */
  router.post("/CIComplete", koaBody(), async (ctx) => {

    if (!ctx.request.body) {
      ctx.body = [{ 'message': 'no items in the cart' }];
    }
    const orderToken = ctx.request.body[0].token;
    const result = await pool.query("SELECT authtoken FROM ciauth WHERE storeorigin = '"+process.env.SHOP+"' ORDER BY id DESC LIMIT 1");
    console.log('orderToken', orderToken);
    console.log('result', result);

    if (result || result.rows) {
      console.log('inside rows if');
      let authtoken = result.rows[0]['authtoken'];
      const client = new Shopify.Clients.Rest(process.env.SHOP, authtoken);
      const checkoutdata = await client.post({
        path: 'checkouts/' + orderToken + '/complete',
        data: {},
        type: DataType.JSON
      })
        .then(data => {
          ctx.body = data;
          ctx.status = 200;
        });
    } else {
      ctx.body = [{ 'message': 'You are not authorised!' }];
      ctx.status = 200;
    }
  });

  /**
   * Save Payment gateway Setting
   */
  router.post("/PaymentGatewaySetting", koaBody(), async (ctx) => {

    const session = await Shopify.Utils.loadCurrentSession(ctx.req, ctx.res);
    ctx.cookies.set('CIShopOrigin', session.shop, {
      httpOnly: false,
      secure: true,
      sameSite: 'none'
    });
    let CIShopOrigin = session.shop;
    var PaymentMode = ctx.request.body.PaymentMode;
    var secretkey = ctx.request.body.SecretKey;
    var partnercode = ctx.request.body.PartnerCode;
    var status = "0";
    let paymentmode = '';
    if (PaymentMode == 'dev') {
      paymentmode = 'dev';
    }else {
      paymentmode = 'live';
    }
    const now = new Date();
    var mess = '';
    var dateTime = date.format(now, 'YYYY/MM/DD HH:mm:ss');
    pool.query("SELECT id FROM cigateway WHERE storeorigin = '" + CIShopOrigin + "' AND paymentmode = '" + paymentmode + "'", function (err, result) {
      if (result.rowCount === 0) {
        pool.query("INSERT INTO cigateway(partnercode, secretkey, storeorigin, paymentmode, status, createddate)VALUES('" + partnercode + "', '" + secretkey + "', '" + CIShopOrigin + "', '" + paymentmode + "', '" + status + "', '" + dateTime + "')",
          (err, res) => {
            ctx.body = 'Inserted data successfully.';
            ctx.status = 200;
            mess = 'Inserted data successfully.';
          }
        );
      } else {
        pool.query("UPDATE cigateway SET partnercode = '" + partnercode + "', secretkey = '" + secretkey + "', updateddate = '" + dateTime + "', status = '" + status + "' WHERE storeorigin = '" + CIShopOrigin + "' AND paymentmode = '" + paymentmode + "'", (err, res) => {

        });
        ctx.body = 'Updated data successfully.';
        ctx.status = 200;
        mess = 'Updated data successfully.';
      }
    }
    );
    ctx.body = "Data Save Successfully !";
    ctx.status = 200;
  });

  /**
    * Save Payment status
    */
  router.post("/PaymentGatewayStatus", koaBody(), async (ctx) => {
    let Paymentcheckstatus = ctx.request.body.statussets;
    const session = await Shopify.Utils.loadCurrentSession(ctx.req, ctx.res);
    ctx.cookies.set('CIShopOrigin', session.shop, {
      httpOnly: false,
      secure: true,
      sameSite: 'none'
    });
    let CIShopOrigin = session.shop;
    if (Paymentcheckstatus == '1') {
      pool.query("UPDATE cigateway SET status = '1' WHERE storeorigin = '" + CIShopOrigin + "' AND paymentmode = 'live'", (err, res) => {
      });
      pool.query("UPDATE cigateway SET status = '0' WHERE storeorigin = '" + CIShopOrigin + "' AND paymentmode = 'dev'", (err, res) => {
      });
    } else {
      pool.query("UPDATE cigateway SET status = '0' WHERE storeorigin = '" + CIShopOrigin + "' AND paymentmode = 'live'", (err, res) => {
      });
      pool.query("UPDATE cigateway SET status = '1' WHERE storeorigin = '" + CIShopOrigin + "' AND paymentmode = 'dev'", (err, res) => {
      });
    }
    ctx.body = 'PaymentGatewaySetting status is Working';
    ctx.status = 200;
  });

  router.get("/ModeDeveloper", async (ctx) => {
    const session = await Shopify.Utils.loadCurrentSession(ctx.req, ctx.res);
    ctx.cookies.set('CIShopOrigin', session.shop, {
      httpOnly: false,
      secure: true,
      sameSite: 'none'
    });
    let CIShopOrigin = session.shop;
    var datas = "";
    const results = await pool.query("SELECT paymentmode,id,partnercode,secretkey FROM cigateway WHERE storeorigin = '" + CIShopOrigin + "' and paymentmode='dev'");
    if (results.rowCount > 0) {
      ctx.body = results;
      ctx.status = 200;
    } else {
      ctx.body = "no data found";
      ctx.status = 200;
    }

  });

  router.get("/Modelive", async (ctx) => {
    const session = await Shopify.Utils.loadCurrentSession(ctx.req, ctx.res);
    ctx.cookies.set('CIShopOrigin', session.shop, {
      httpOnly: false,
      secure: true,
      sameSite: 'none'
    });
    let CIShopOrigin = session.shop;
    var datas = "";
    const results = await pool.query("SELECT paymentmode,id,partnercode,secretkey FROM cigateway WHERE storeorigin = '" + CIShopOrigin + "' and paymentmode='live'");
    if (results.rowCount > 0) {
      ctx.body = results;
      ctx.status = 200;
    } else {
      ctx.body = "no data found";
      ctx.status = 200;
    }
  });

  /***
   * Toggle button data featch 
   */
  router.get("/TooglbuttGet", async (ctx) => {
    const session = await Shopify.Utils.loadCurrentSession(ctx.req, ctx.res);
    ctx.cookies.set('CIShopOrigin', session.shop, {
      httpOnly: false,
      secure: true,
      sameSite: 'none'
    });
    let CIShopOrigin = session.shop;
    const resulttoggle = await pool.query("SELECT paymentmode,status FROM cigateway WHERE storeorigin = '" + CIShopOrigin + "' and status='1' and paymentmode='live'");
    if (resulttoggle.rowCount > 0) {
      console.log("Pay mode live status : ", resulttoggle.rows);
      ctx.body = resulttoggle.rows;
      ctx.status = 200;
    } else {
      ctx.body = "no data found";
      ctx.status = 200;
    }
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
    if (!ctx.request.body) {
      ctx.body = [{ 'message': 'no items in the cart' }];
    }
    let CIShopOrigin = process.env.SHOP;
    let partnercode = "tis86";
    let secretkey = "DEV43543TIS";
    let paymentmode = "Dev";
    let dateTime = "2022-01-04";

    if (paymentmode == 'Dev') {
      var status = "1";
    } else {
      var status = "0";
    }
    pool.query("SELECT id FROM cigateway WHERE storeorigin = '" + CIShopOrigin + "' AND paymentmode = '" + paymentmode + "'", function (err, result) {
      if (result.rowCount == 0) {
        pool.query("INSERT INTO cigateway(partnercode, secretkey, storeorigin, paymentmode, status, createddate)VALUES('" + partnercode + "', '" + secretkey + "', '" + CIShopOrigin + "', '" + paymentmode + "', '" + status + "', '" + dateTime + "')",
          (err, res) => {
            console.log('Inserted into DB ');
          }
        );
      } else {
        pool.query("UPDATE cigateway SET partnercode = '" + partnercode + "', secretkey = '" + secretkey + "', paymentmode = '" + paymentmode + "', updateddate = '" + dateTime + "', status = '" + status + "' WHERE storeorigin = '" + CIShopOrigin + "' AND paymentmode = '" + paymentmode + "'", (err, res) => {

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