import { Heading, Page, TextField } from "@shopify/polaris";
import React, { useEffect } from 'react';

function Index(props){

  useEffect(() => {
    SetCIAccessToken();
  }, []);

  async function SetCIAccessToken(){
    const res = await props.axios_instance.get("/setAccessToken");
    return res;
  }
  
  // https://a097-115-166-143-82.ngrok.io/?shop=tisrr.myshopify.com&host=dGlzcnIubXlzaG9waWZ5LmNvbS9hZG1pbg
  // "dev": "cross-env NODE_ENV=development nodemon ./server/index.js --watch ./server/index.js",

  async function getProducts(){
    const res = await props.axios_instance.get("/products");
    return res;
  }

  async function handleClick() {
    const result = await getProducts();
    console.log('Here are the products - ', result);
  }

  // async function SetPartnerData(){
  //   const res = await props.axios_instance.post("/SetPartnersData");
  //   return res;
  // }


  async function getProductListings(){
    const res = await props.axios_instance.get("/product_listings");
    return res;
  }

  async function getCICheckout(){
    const res = await props.axios_instance.get("/CICheckout");
    return res;
  }
  
  async function getCalculateShipping(){
    const res = await props.axios_instance.get("/CalculateShipping/0e6072322af26208e573b890e21b32be");
    return res;
  }

  return (
    <Page>
      <Heading>Payment Gateway Credentials - </Heading>



      {/* <form>
      <div class="form-group">
        <label for="email">Partner Id</label>
        <input type="text" name="partnerid" placeholder="Partner Id" class="form-control"></input>
        </div>
    
        <div class="form-group">
        <label for="email">Token</label>
        <input type="text" name="token" placeholder="Token" class="form-control"></input>
        </div>

        <input type="button" value="Save" onClick={SetPartnerData} className="btn btn-info"></input>

      </form> */}



      <br />
      <input
        value="Get Products"
        type="button"
        onClick={handleClick}
      ></input>
      <br />
      <br />
      <input
        value="Set Access Token"
        type="button"
        onClick={SetCIAccessToken}
      ></input>

      <br />
      <br />
      <input
        value="Get Product Listings"
        type="button"
        onClick={getProductListings}
      ></input>
      
      <br />
      <br />
      <input
        value="CICheckout"
        type="button"
        onClick={getCICheckout}
      ></input>

      <br />
      <br />
      <input
        value="CalculateShipping"
        type="button"
        onClick={getCalculateShipping}
      ></input>

    </Page>
  );
}
export default Index;


    // const details = {
    //   orderReference: abc123456789,
    //   txnAmount: 300.00,
    //   currencyType: INR,
    //   checkSum: hash
    // };

    // var formBody = [];
    // for (var property in details) {
    //   var encodedKey = encodeURIComponent(property);
    //   var encodedValue = encodeURIComponent(details[property]);
    //   formBody.push(encodedKey + "=" + encodedValue);
    // }
    // formBody = formBody.join("&");

    // var qs = require('qs');
    // var data = qs.stringify({
    //   'orderReference': 'tici1234564',
    //   'txnAmount': '300.00',
    //   'currencyType': 'INR',
    //   'checkSum': '9322602139549d5e018cc88fe48f41daf20b6c0f680835da153c6dec6844588d' 
    // });
    // var config = {
    //   method: 'post',
    //   url: 'https://demo.retail.cipay.inspirenetz.com/loyaltypg/public/payment/shopify-test/initiate',
    //   headers: { 
    //     'Content-Type': 'application/x-www-form-urlencoded'
    //   },
    //   data : data
    // };

    // axios(config)
    // .then(function (response) {
    //   console.log(JSON.stringify(response.data));
    // })
    // .catch(function (error) {
    //   console.log(error);
    // });




    // fetch(reqURL, {
    //   method: 'POST', // or 'PUT'
    //   headers: {
    //     'Content-Type': 'application/x-www-form-urlencoded'
    //   },
    //   body: encodeURIComponent(JSON.stringify({
    //     currencyType: 'INR',
    //     orderReference: 'tici1234564',
    //     txnAmount: 300.00,
    //     checkSum: '9322602139549d5e018cc88fe48f41daf20b6c0f680835da153c6dec6844588d'
    //   })),
    // })
    // .then(response => response.json())
    // .then(data => {
    //   console.log('Success Payement:', data);
    // })
    // .catch((error) => {
    //   console.error('Error:', error);
    // });


    // var formBody = [];
    // for (var property in details) {
    //   var encodedKey = encodeURIComponent(property);
    //   var encodedValue = encodeURIComponent(details[property]);
    //   formBody.push(encodedKey + "=" + encodedValue);
    // }
    // formBody = formBody.join("&");   
    
    // axios
    // .post('https://whatever.com/todos', {
    //   todo: 'Buy the milk'
    // })
    // .then(res => {
    //   console.log(`statusCode: ${res.status}`)
    //   console.log(res)
    // })
    // .catch(error => {
    //   console.error(error)
    // })

    // fetch(reqURL, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
    //   },
    //   body: formBody
    // })
    // .then(res => res.text())
    // .then(text => console.log(text))
    // .catch((error) => {
    //   assert.isNotOk(error,'Promise error');
    //   done();
    // });