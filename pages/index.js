import { Heading, Page, TextField } from "@shopify/polaris";
import React, { useEffect, useState } from 'react';
//import { toast, ToastContainer } from 'react-nextjs-toast'
import toast, { Toaster } from 'react-hot-toast';


function Index(props){

  var [SecretDeveloper, setSecretDeveloper] = useState('');
  var [PartnerDeveloper, setPartnerDeveloper] = useState('');
  
  var [SecretLive, setSecretLive] = useState('');
  var [PartnerLive, setPartnerlive] = useState('');
  


  var [sett, setSett] = useState(true);
  var [paymen, setPayment] = useState(false);  

  var [secre1, setSecre1] = useState();
  var [part1, setPartn1] = useState();

  var [secre2, setSecre2] = useState();
  var [part2, setPartn2] = useState();

  var [toog, settoog] = useState();

  var [devl, setDevl] = useState(true);
  var [liv, setLiv] = useState(false);
  
  var [paymentMode, setPaymentMode] = useState('dev');

  var [check, setCheck] = useState(true);

  function hover_toggle(e)
  {
    var element = document.getElementsByClassName(".custom-control-label");
    e.target.classList.toggle("toggleclass");
  }

  var togglepaym = () => {
    setSett(false);
    setPayment(true);
  }

  var togglesett = () => {
    setSett(true);
    setPayment(false);
  }

  const toggledev = () => {
    setDevl(true);
    setLiv(false);
    setPaymentMode("dev")
  }

  const togglelive = () => {
    setLiv(true);
    setDevl(false);
    setPaymentMode("live")
  }

  const checkbox1 = (e) => {
    setCheck(!check);
    var checka = check
      if(checka==true)
      {
        var st = '1';
      }else{
        var st = '0';
      }
      let checkastatus = {};
       checkastatus = {'statussets': st  };
       const res =  props.axios_instance.post("/PaymentGatewayStatus", checkastatus)
  }

  async function SaveSetting(e) { 
    e.preventDefault();
      
      let requestdata ={}
      let requestdatalive ={}
      if(paymentMode == 'live' ) { 
      requestdatalive = {'SecretKey': secre2, 'PartnerCode': part2, 'PaymentMode': paymentMode };
      const res = await props.axios_instance.post("/PaymentGatewaySetting", requestdatalive)
       // setPaymentMode()
       toast.success(res.data)
      } 
      else {  
       
      requestdata = {'SecretKey': secre1, 'PartnerCode': part1, 'PaymentMode': paymentMode };
          const res = await props.axios_instance.post("/PaymentGatewaySetting", requestdata)
        console.log(res.data);
        toast.success(res.data);
      }
}

  function live1(e) {
    e.preventDefault();
    console.log(secre2 + " " + part2 + " " + hidde);
  }

  useEffect(() => {
    SetCIAccessToken();
    Setpaymentparam();
   // RetrievesCheckouts();
  }, []);

  async function SetCIAccessToken(){
    const res = await props.axios_instance.get("/setAccessToken");
    return res;
  }  

  async function getProducts(){
    const res = await props.axios_instance.get("/products");
    return res;
  }

  async function handleClick() {
    const result = await getProducts();
    console.log('Here are the products - ', result);
  }

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

  
  async function Setpaymentparam(){

    const resparam = await props.axios_instance.get("/ModeDeveloper");
    const resparamlive = await props.axios_instance.get("/Modelive");
    const Tooglbutt = await props.axios_instance.get("/TooglbuttGet");

    // console.log("live data ===========", resparamlive.data);
    // console.log("developer ===========", resparam.data);
    settoog(Tooglbutt.data[0].status);
      if(resparam.data != 'no data found'){
          let data = resparam.data.rows
        data = data.filter(function(item){

          console.log(item.paymentmode);
          return item.paymentmode == 'dev';
        }).map(function({id, partnercode, paymentmode, secretkey }){
            return {id, partnercode, paymentmode, secretkey};
        });
        setPartn1(data[0].partnercode)
        setSecre1(data[0].secretkey);
    }

      if(resparamlive.data != 'no data found'){
        let datalive = resparamlive.data.rows
        datalive = datalive.filter(function(item){
          return item.paymentmode == 'live';
        }).map(function({id, partnercode, paymentmode, secretkey }){
            return {id, partnercode, paymentmode, secretkey};
        });
        setPartn2(datalive[0].secretkey)
        setSecre2(datalive[0].partnercode)
    }

  } 

  // async function RetrievesCheckouts(){
  //   const Retr = await props.axios_instance.get("/retrievescheckout");
  //   console.log("Retrdata >>>> ", Retr)
  // }



  return (
    <Page>      
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@4.6.1/dist/css/bootstrap.min.css" integrity="sha384-zCbKRCUGaJDkqS1kPbPd7TveP5iyJE0EjAuZQTgFLD2ylzuqKfdKlfG/eSrtxUkn" crossorigin="anonymous"></link>
      <Heading>Payment Gateway Credentials - </Heading>
      <>
      <Toaster />

        <div className="mt-5 payment-tabs" id="gateway-pay">          
          <div className="w-100 p-2 d-flex flex-row">

            <div className="tab shadow border rounded" id="sidebar-tab">
              <button className="tablinks"  className={sett ? 'pay-btn' : 'pay-buttn'} id="defaultOpen" onClick={togglesett}><b>Settings</b></button>
              <button className="tablinks" className={paymen ? 'pay-btn' : 'pay-buttn'} onClick={togglepaym} ><b>Payment Mode</b></button>
            </div>

            <div className={sett ? 'active w-100 p-2 d-flex flex-row' : 'nonactive'} id="rightbar">

              <div className={devl ? 'active w-100 p-2 d-flex flex-row' : 'nonactive'} >

                <div id="payment" className="tabcontent shadow w-100 ml-4 border p-3 rounded">
                  <div className="tabbtn border-bottom pb-1 mb-2">
                    <button className="tablinks"  className={devl? 'pay-btn' :null} onclick="openCity(event, 'payment')" id="defaultOpen" onClick={toggledev}><b>Development</b></button>
                    <button className="tablinks"  className={liv? 'pay-btn' :null} onclick="openCity(event, 'payment-method')" onClick={togglelive} ><b>Live</b></button>
                  </div>

                  

                  <form onSubmit={SaveSetting}>
                    <div className="form-group">
                      <label for="exampleInputEmail1">Secrete Key</label>
                      <input type="text" required={true} className="form-control" id="exampleInputEmail1" aria-describedby="emailHelp" onChange={(e) => setSecre1(e.target.value)} minlength="10" value={secre1} />
                      <small id="emailHelp" className="form-text text-muted">Please do not share this secrete key with any one else.</small>
                    </div>
                    <div className="form-group">
                      <label for="exampleInputPassword1">Partner Code</label>
                      <input type="text" required={true} className="form-control" id="exampleInputPassword1" onChange={(e) => setPartn1(e.target.value)} minlength="10" value={part1} />
                    </div>
                    <div className="form-group form-check">
                       <input type="hidden" value="development" onChange={()=>setPaymentMode("dev") } />

                    </div>
                    <button type="submit" className="btn btn-primary pay-btn border-0"  >Submit</button>
                  </form>



                </div>
              </div>
              <div className={liv ? 'active w-100 p-2 d-flex flex-row' : 'nonactive'} >
                <div id="payment" className="tabbtn tabcontent shadow w-100 ml-4 border p-3 rounded">
                  <div className="border-bottom pb-1 mb-2">

                    <button className="tablinks"  className={devl? 'pay-btn' :null} onclick="openCity(event, 'payment')" id="defaultOpen" onClick={toggledev}><b>Development</b></button>
                    <button className="tablinks"  className={liv? 'pay-btn' :null} onclick="openCity(event, 'payment-method')" onClick={togglelive} ><b>Live</b></button>
                  </div>
                  <form onSubmit={SaveSetting}>
                    <div className="form-group">
                      <label for="exampleInputEmail1">Secrete Key</label>
                      <input type="text" required={true} className="form-control" id="exampleInputEmail1" aria-describedby="emailHelp" onChange={(e) => setSecre2(e.target.value)} minlength="10" value={secre2} />
                      <small id="emailHelp" className="form-text text-muted">Please do not share this secrete key with any one else.</small>
                    </div>
                    <div className="form-group">
                      <label for="exampleInputPassword1">Partner Code</label>
                      <input type="text" required={true} className="form-control" id="exampleInputPassword1" onChange={(e) => setPartn2(e.target.value)} minlength="10" value={part2}/>
                    </div>
                    <div className="form-group form-check">
                    <input type="hidden" value="live" onChange={()=>setPaymentMode("live") } />

                    </div>
                    <button type="submit" className="btn btn-primary pay-btn border-0"  >Submit</button>
                  </form>
                </div>
              </div>
            </div>

            <div className={paymen ? 'active w-100 p-2 d-flex flex-row' : 'nonactive'}  >
              <div id="payment-method" className="tabcontent shadow w-100 ml-4 border p-3 rounded">
                <div className="border-bottom pb-1 mb-2">
                  <h3>Payment Mode</h3>
                </div>                
                <div className="custom-control custom-switch">


                  
                  <span>Development</span>
                  <input type="checkbox" className="custom-control-input"  id="customSwitch1" onClick={checkbox1} checked={(toog===1)? true: false} />
                  <label className="custom-control-label" id="toogle" for="customSwitch1" onClick={hover_toggle}>Live</label>
                </div>
              </div>
            </div>
          </div>
        </div>

      </>

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



      {/* <br />
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
      ></input> */}




      
{/* <input
        value="CalculateShipping"
        type="button"
        onClick={Setpaymentparam}
      ></input> */}

{/* <input
        value="Retrieves Checkout"
        type="button"
        onClick={RetrievesCheckouts}
      ></input> */}

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