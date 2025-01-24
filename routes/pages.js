const mysql = require("mysql");
const express = require('express');
const authController = require('../controllers/auth');
var fs = require('fs');
const geoip = require('geoip-lite');

const router = express.Router();

async function getIp(req,res){
    //console.log("User trying to access a site... running log.")
    //console.log("xforward",req.headers['x-forwarded-for'])
    //console.log("req.connection.remoteAddress",req.connection.remoteAddress)
    var ip = req.connection.remoteAddress || req.headers['x-forwarded-for'];  
    if (ip.substr(0, 7) == "::ffff:") {
        ip = ip.substr(7)
    }
    var geo = geoip.lookup(ip)
    var geoString = `[IP:${ip}]\n[Country:${geo.country}]\n[State:${geo.region}]\n[City:${geo.city}]\n[Timezone:${geo.timezone}]\n`

    if (req.user){
        var user = req.user.name
        var userid = req.user.user_id
        var useremail = req.user.user_email
        
    }else{
        var user = "ANONYMOUSE USER"
        var userid = "null"
        var useremail = "null"

    }

    log = `(REQUEST PAGE ${req.headers.host}${req.route.path}) \n[U:${user}]\n[ID:${userid}]\n[E:${useremail}]\n${geoString}\n[UA:${req.headers['user-agent']}]\n[REF:${req.headers.referer}]\n`
    console.log(log)
    console.log("")
    //Check VPN status
    if ( (geo.country.length<1) || (geo.timezone.length<1) ){
        console.log(`${user} TRIED TO LOGIN FROM INVALID IP ${new Date()}`)
        return "invalid"
    }
    else{

        
    }
}

router.get('/', authController.isLoggedIn, async (req,res) => {
    ip = await getIp(req,res)
    if (ip == "invalid"){
        return res.redirect('invalid','401', {  
            message: 'ERROR: Cannot specify origin of IP address, are you using a proxy?'
        })
    }
    return res.render('login', {
        user: req.user
    });
});
router.get('/index2', authController.isLoggedIn, async (req,res) => {
    ip = await getIp(req,res)
    if (ip == "invalid"){
        return res.redirect('invalid','401', {  
            message: 'ERROR: Cannot specify origin of IP address, are you using a proxy?'
        })
    }
    res.render('index', {
        user: req.user
    });
});

router.get('/index', authController.isLoggedIn, async (req,res) => {
    ip = await getIp(req,res)
    if (ip == "invalid"){
        return res.redirect('invalid','401', {  
            message: 'ERROR: Cannot specify origin of IP address, are you using a proxy?'
        })
    }
    res.render('index2', {
        user: req.user
    });
});

router.get('/register', async (req,res) => {
    ip = await getIp(req,res)
    if (ip == "invalid"){
        return res.redirect('invalid','401', {  
            message: 'ERROR: Cannot specify origin of IP address, are you using a proxy?'
        })
    }
    res.render('register');
});

router.get('/forgotpass', async (req,res) => {
    ip = await getIp(req,res)
    if (ip == "invalid"){
        return res.redirect('invalid','401', {  
            message: 'ERROR: Cannot specify origin of IP address, are you using a proxy?'
        })
    }
    res.render('forgotpass');
});

router.get('/login', async (req,res) => {
    ip = await getIp(req,res)
    if (ip == "invalid"){
        return res.redirect('invalid','401', {  
            message: 'ERROR: Cannot specify origin of IP address, are you using a proxy?'
        })
    }
    res.render('login');
});

router.get('/invalid', async (req,res) => {
    res.render('invalid');
});

module.exports = router;