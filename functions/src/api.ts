import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as OAuthClient from 'intuit-oauth';
import * as cors from 'cors';

admin.initializeApp();

const app = express();
app.use(cors({ origin: true }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const urlencodedParser = bodyParser.urlencoded({ extended: false });
let oauth2_token_json = '';
let access_token = '';

const oauthClient = new OAuthClient({
  clientId: functions.config().qbconfig.clientid,
  clientSecret: functions.config().qbconfig.clientsecret,
  environment: functions.config().qbconfig.environment,
  redirectUri: 'https://us-central1-intuit-oauth2-api.cloudfunctions.net/api/callback'
});

app.get('/authUri', urlencodedParser, (req, res) => {
  const authUri = oauthClient.authorizeUri({scope:[OAuthClient.scopes.Accounting,OAuthClient.scopes.Payment],state:'intuit-test'});
  console.log('authUri', '=>', authUri);
  const respUri = { authUri: authUri };
  res.send(respUri)
});

app.get('/callback', (req, res) => {
  oauthClient.createToken(req.url)
    .then((authResponse) => {
      access_token = authResponse.access_token;
      console.log('access_token', '=>', access_token);
      oauth2_token_json = JSON.stringify(authResponse.getJson(), null, 2);
      console.log('oauth2_token_json', '=>', oauth2_token_json);
      const response = { response: 'You can close this window' };
      res.send(response);
    })
    .catch((e) => {
      console.error(e);
      res.status(500).send(e);
    });
});

app.get('/retrieveToken', (req, res) => {
  res.send(oauth2_token_json);
});

app.get('/refreshAccessToken', (req, res) => {
  oauthClient.refresh()
    .then((authResponse) => {
      console.log('The Refresh Token is  '+ JSON.stringify(authResponse.getJson()));
      oauth2_token_json = JSON.stringify(authResponse.getJson(), null,2);
      console.log('oauth2_token_json', '=>', oauth2_token_json);
      res.send(oauth2_token_json);
    })
    .catch((e) => {
      console.error(e);
      res.status(500).send(e);
    });
});

app.get('/getCompanyInfo', (req, res) => {
  const companyID = oauthClient.getToken().realmId;
  console.log('companyID', '=>', companyID);
  oauthClient.makeApiCall({ url: `${functions.config().qbconfig.apiuri}${companyID}/companyinfo/${companyID}` })
    .then((apiResponse) => {
      console.log("The response for API call is :"+JSON.stringify(apiResponse));
      res.send(JSON.parse(apiResponse.text()));
    })
    .catch((e) => {
      console.error(e);
      res.status(500).send(e);
    });
});

app.get('/getCustomer', (req, res) => {
  const companyID = oauthClient.getToken().realmId;
  console.log('companyID', '=>', companyID);
  const id = req.query.id;
  console.log('/getCustomer', '=>', id);
  if (id) {
    oauthClient.makeApiCall({ url: `${functions.config().qbconfig.apiuri}${companyID}/customer/${id}` })
      .then((apiResponse) => {
        console.log("The response for API call is :"+JSON.stringify(apiResponse));
        res.send(JSON.parse(apiResponse.text()));
      })
      .catch((e) => {
        console.error(e);
        res.status(500).send(e);
      });
  } else {
    res.status(204).send({ message: 'query string :id is required'});
  }
});

app.post('/createCustomer', (req, res) => {
  const companyID = oauthClient.getToken().realmId;
  console.log('companyID', '=>', companyID);
  const payload = req.body;
  console.log('/createCustomer', '=>', payload);
  const options = {
    method: 'POST',
    uri: `${functions.config().qbconfig.apiuri}${companyID}/customer`,
    body: payload,
    headers: {
      'Authorization': `Bearer ${access_token}`
    }
  };
});
export const api = functions.https.onRequest(app);