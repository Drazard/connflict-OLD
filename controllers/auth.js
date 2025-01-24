const mysql = require("mysql");
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { promisify } = require("util");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const funcs = require('../functions');
const geoip = require('geoip-lite');

const db = mysql.createConnection({
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASS,
    database: process.env.DATABASE
});

exports.login = async (req, res) => {
    //console.log("req.body: ",req.body)
    let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    if (ip.substr(0, 7) == "::ffff:") {
        ip = ip.substr(7)
      }
    let geo = geoip.lookup(ip)
    let geoString = `Country:${geo.country} State:${geo.region} City:${geo.city}`

    //funcs.log(`user (${geoString}) is trying to login`)
    try {    
        var {email, password} = req.body;
        //console.log(email, password)
        if( !email || !password ) {
            return res.status(400).render('login', {
                message: 'Email or password missing.'
            })
        }
        

        db.query('SELECT * FROM users WHERE user_email = ?', [email], async (error, results) => {

            //console.log(results[0].user_activated)
            //funcs.log(results)
            //console.log(await bcrypt.compare(password, results[0].user_password))
            try {
                if( !results ){
                    return res.status(401).render('login', {
                        message: 'Email or Password Incorrect'
                    })
                    
                }else if( !(await bcrypt.compare(password, results[0].user_password)) ){
                    return res.status(401).render('login', {
                        message: 'Email or Password Incorrect'
                    })
                }else if( await results[0].user_activated == 0 ) {
                    //funcs.log("Account not activated!")
                    return res.status(400).render('login', {
                        message: 'Account not activated.'
                    })
                }else{

                    if(results[0].user_banned > 0){
                        console.log("Banned user tried to login")
                        return res.status(401).render('login', {
                            message: 'Youve been banned.'
                        })
                    }

                   //funcs.log("Account Activated.. logging in...")
                    funcs.log(`(${ip}) USER AND PASS SUCCESS! Logging in.. [${email}, ${password}]`);
                    const token = jwt.sign({ id: results[0].user_id }, process.env.JWT_SECRET, {
                        expiresIn: process.env.JWT_EXPIRES_IN
                    });

                   //funcs.log("The token is: " + token);

                    const cookieOptions = {
                        expires: new Date(
                            Date.now() + process.env.JWT_COOKIE_EXPIRES * 24 * 60 * 60 * 1000
                        ),
                        httpOnly: true
                    }
                    //console.log(token)
                    //console.log('TOKEN -----------------------------------------')
                    db.query(`UPDATE users SET user_logintoken = '${token}' WHERE user_email = ?`, [email], async (error, results) => {
                        if (error) {
                            funcs.log(error);
                            console.log("ERROR IN DATABASE THING 13515")
                        }
                        //console.log(`SET  ${email} chatID ${token}`);
                    });
                    //funcs.log("cookie options: " + cookieOptions.expires);
                    await res.cookie('draz', token, cookieOptions );
                    //console.log("success code 51295609")

                    await db.query(`INSERT log_login SET ?`, {user_email:email, log_login_ip: ip})
                    //await console.log("LOGGING LOGIN");
                    await res.redirect('/index');
                    //await console.log("LOGGING LOGIN REDIRECT");
                    //funcs.log("logged into Profile?"); 
                }
            } catch (error) {
                console.log("LOGIN ERROR"+error)
                //funcs.log(error);
                res.status(401).render('login', {
                    message: `ERROR: Email or Password Incorrect?
                    
                    Accounts have been reset, please re-register if you created your account before August 1st`
                })
            }
        })

    } catch (error) {
        console.log("ERRORWITHLOGIN3"+error)
        funcs.log(error);
    }
}

exports.logout = async (req, res) => {
    try {
        res.cookie('draz', 'logout',{
            expires: new Date(Date.now() + 2 * 1000),
            httpOnly: true
        });
    
        return res.status(200).redirect('/login');

    } catch (error) {
        res.cookie('draz', 'logout',{
            expires: new Date(Date.now() + 2 * 1000),
            httpOnly: true
        });
    
        return res.status(200).redirect('/login');
    }
    
}

exports.register = async (req, res) => {

    var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    if (ip.substr(0, 7) == "::ffff:") {
        ip = ip.substr(7)
      }
    let geo = await geoip.lookup(ip)
    console.log(geo)
    if ( (geo.country.length<1)  ){ //|| (geo.region.length<1) || (geo.city.length<1)
        console.log("USER TRIED TO LOGIN FROM INVALID IP")
        return res.render('invalid', {
            message: 'ERROR: Cannot specify origin of IP address, are you using a proxy?'
        })
    }
    
    //let geoString = `${ip} ${geo.country}>${geo.region}>${geo.city}`
    //funcs.log(`user (${ip}) is trying to register`)
    //This is a deconstructed version of the above declaritions.
    var {name, email} = req.body
    name = name.trim()
    name = name.replace(/[^a-zA-Z0-9-]/g,'');
    var password = crypto.randomBytes(21).toString('base64').slice(0, 10)
    console.log("password", password, "name", name)
    
    db.query('SELECT * FROM users WHERE user_email = ? OR user_name = ? OR user_ip = ?', [email,name,ip], async (error, results) => {
        if(error){
            funcs.log("ERROR IN REGISTRATION",error);
        }
        if( results.length > 0 ) {
            return res.render('register', {
                message: 'You already have an account!'
            })
        } else if( name.length < 3 ) {
            console.log(`name '${name}' is too short`)
            console.log(`name length is: ${name.length}`)
            return res.render('register', {
                message: `Username '${name}' too short! (3 minimum)`
            });
        } else if( name.length > 30 ) {
            console.log(`name '${name}' is too long (30 max)`)
            console.log(`name length is: ${name.length}`)
            return res.render('register', {
                message: `Username '${name}' too long!`
            });
        }

        let verifycode = name.replace(" ","") + crypto.randomBytes(5).toString('hex')

        let transporter = await nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 587,
            secure: false, // use SSL
            auth: {
                user: process.env.GMAIL_USERNAME, // username for your mail server
                pass: process.env.GMAIL_PASSWORD, // password
            },
    
        });
        

        try {
            // send mail with defined transport object

            let info = await transporter.sendMail({
                from: '"ADMIN" <DRAZARDGAME@GMAIL.COM>',
                to: email,
                subject: "Connflict Account Verification",
                text: `
                Thank you ${name} for registering! your password is '${password}'
                Click on the link below to veriy your account https://www.connflict.com:3000/auth/verify?id=${verifycode}

                For security purpouses all user account passwords are generated and cannot be changed, please do not lose this email.
                
                By activating your account you agree to Connflicts terms and conditions. You also agree that you are 18 years or older. If you are not 18 years or older please do not verify.`,
            }, async (error, info) => {

                if (error) {
                    funcs.log("Error within the transporter", error);
                    funcs.log("Account creation aborted", error)
                    funcs.log(error)
                    let  accountCreate = await 0;
                    //funcs.log(accountCreate);
                    res.render('register', {
                        message: 'Account Creation Failed! (connflict google account issue)'
                    });
                    return transporter.close();
                } else{

                    /*Adding verified data to the batabase */
                    let hashedPassword = await bcrypt.hash(password, 1);
                    let startingIP = funcs.randomIP();
                    //funcs.log(hashedPassword);
                    db.query('INSERT users SET ?', { 
                        user_name: name, 
                        user_email: email, 
                        user_password: hashedPassword, 
                        user_emailverify: verifycode, 
                        user_ip:ip,
                        hostip:startingIP,
                        remoteip:startingIP
                    }, (error, results) => {
                        if (error) {
                            funcs.log(error);
                            funcs.log("Error with registration db");
                        }else{
                            db.query('INSERT log_signup SET ?', {
                                log_signup_name:name, 
                                log_signup_email: email, 
                                log_signup_ip:ip, 
                                log_signup_country:geo.country, 
                                log_signup_state:geo.region, 
                                log_signup_city:geo.city, 
                                log_signup_timezone:geo.timezone, 
                                log_signup_useragent:req.headers['user-agent'], 
                                log_signup_time:datetimestamp
                            })
                            //funcs.log(results);
                            return res.render('login', {
                                message: 'User Created!'
                            });
                        }
                    })
                }
                
            });

            /*------------------SMTP Over-----------------------------*/

            
            
        } catch (error) {
            return res.render('register', {
                message: 'Error with email address! (end)'
            });
        }
            
    });
    

    //res.send("Form Submitted");
}

exports.forgotpass = async (req, res) => {

    var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    if (ip.substr(0, 7) == "::ffff:") {
        ip = ip.substr(7)
      }
    let geo = await geoip.lookup(ip)
    console.log(geo)
    if ( (geo.country.length<1)  ){ //|| (geo.region.length<1) || (geo.city.length<1)
        console.log("USER TRIED TO LOGIN FROM INVALID IP")
        return res.render('invalid', {
            message: 'ERROR: Cannot specify origin of IP address, are you using a proxy?'
        })
    }
    
    //let geoString = `${ip} ${geo.country}>${geo.region}>${geo.city}`
    //funcs.log(`user (${ip}) is trying to register`)
    //This is a deconstructed version of the above declaritions.
    var {email, name} = req.body
    name = name.trim()
    name = name.replace(/[^a-zA-Z0-9-]/g,'');
    var password = crypto.randomBytes(21).toString('base64').slice(0, 10)
    console.log("password", password)
    
    db.query('SELECT * FROM users WHERE user_email = ?', [email], async (error, results) => {
        if(error){
            funcs.log("ERROR IN REGISTRATION",error);
            return res.render('forgotpass', {
                message: 'email or username wrong!'
            })
        }
        if( results.length < 0 ) {
            return res.render('forgotpass', {
                message: 'email or username wrong!'
            })
        }

        let transporter = await nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 587,
            secure: false, // use SSL
            auth: {
                user: process.env.GMAIL_USERNAME, // username for your mail server
                pass: process.env.GMAIL_PASSWORD, // password
            },
    
        });
        

        try {
            // send mail with defined transport object

            let info = await transporter.sendMail({
                from: '"ADMIN" <DRAZARDGAME@GMAIL.COM>',
                to: email,
                subject: "Connflict Account Password Recovery",
                text: `
                Hello ${name}, your new password is '${password}'
                
                Please keep it safe!

                (For security purpouses all user account passwords are randomly generated, please keep this password safe.
                
                By using Connflict you agree to all terms and conditions. You also agree that you are 18 years or older. If you are not 18 years or older please do not continue to login.`,
            }, async (error, info) => {

                if (error) {
                    funcs.log("Error within the transporter", error);
                    funcs.log("Account creation aborted", error)
                    funcs.log(error)
                    let  accountCreate = await 0;
                    //funcs.log(accountCreate);
                    res.render('login', {
                        message: 'Password Recovery Failed! (connflict google account issue)'
                    });
                    return transporter.close();
                } else{

                    /*Adding verified data to the batabase */
                    let hashedPassword = await bcrypt.hash(password, 1);
                    //funcs.log(hashedPassword);
                    db.query(`
                    UPDATE users 
                    SET user_password = '${hashedPassword}'
                    WHERE user_email = '${email}'`)

                    
                    db.query('INSERT log_passchange SET ?', {
                        email: email, 
                        name:name,
                        ip:ip, 
                        country:geo.country, 
                        region:geo.region, 
                        city:geo.city, 
                        timezone:geo.timezone, 
                        useragent:req.headers['user-agent'], 
                        changetime:datetimestamp
                    })
                    
                    res.render('login', {
                        message: 'Password Recovery email Sent!'
                    });
                }
                
            });

            /*------------------SMTP Over-----------------------------*/

            
            
        } catch (error) {
            return res.render('login', {
                message: 'Error with email address! (end)'
            });
        }
            
    });
    

    //res.send("Form Submitted");
}

exports.verify = async (req, res) => {
    
    //funcs.log(req)
    //funcs.log(req.query.id)
    //funcs.log(req.body)
    //console.log(req)
    await db.query('UPDATE users SET user_activated = 1 WHERE user_emailverify = ?', [req.query.id], async (error, results) => {
        
        //funcs.log(results)
    });

   await db.query('SELECT * FROM users WHERE user_emailverify = ?', [req.query.id], async (error, results) => {
        let userVerified = results[0].user_activated
        if(!userVerified){
            //User already verified do nothing
        }else{
            console.log("User verifying", results[0].user_name)
            //set account to verified
            await db.query('UPDATE users SET user_activated = 1 WHERE user_emailverify = ?', [req.query.id]) 
            let id = results[0].user_id 
            let randIP = funcs.randomIP();
            //Giving the user a new temrinal
            // await db.query(`UPDATE users SET ? WHERE user_id = '${results[0].user_id}'`, {
            //     hostip: randIP, 
            //     remoteip: randIP
            // })
            //giving the user a new wallet
            await db.query(`INSERT user_wallets SET ?`, {
                user_id: id, 
                wallet_type:"btc"
            })
            await db.query(`INSERT user_wallets SET ?`, {
                user_id: id, 
                wallet_type:"burst"
            })
            await db.query(`INSERT user_wallets SET ?`, {
                user_id: id, 
                wallet_type:"drazcoin"
            })
            await db.query(`INSERT user_wallets SET ?`, {
                user_id: id, 
                wallet_type:"eth"
            })
            await db.query(`INSERT user_wallets SET ?`, {
                user_id: id, 
                wallet_type:"bank1"
            })
            await db.query(`INSERT user_wallets SET ?`, {
                user_id: id, 
                wallet_type:"bank2"
            })
            await db.query(`INSERT user_wallets SET ?`, {
                user_id: id, 
                wallet_type:"bank3"
            })
            await db.query(`INSERT user_wallets SET ?`, {
                user_id: id, 
                wallet_type:"bank4"
            })
            await db.query(`INSERT user_wallets SET ?`, {
                user_id: id, 
                wallet_type:"bank5"
            })
            //setting up bank acocunts

        }
    });
    return res.render('login', {
        message: "Account verified"
    });
}

exports.isLoggedIn = async (req, res, next) => {
    if( req.cookies.draz ){
        try {
            // 1 Verify the token
            const decoded = await promisify(jwt.verify)(
                req.cookies.draz,
                process.env.JWT_SECRET
                );
            //funcs.log(decoded);

            // 2 check if the user exists
            db.query('SELECT * FROM users WHERE user_id = ?', [decoded.id], (error, result) => {
                //funcs.log(result);

                if(!result){
                    return next();
                }

                req.user = result[0];
                return next();
            });
        } catch (error) {
            console.log("LOGINERROR"+error)
           //funcs.log(error);
            return next();
        }
    } else{
        try {
            next();
        } catch (error) {
            console.log("LOGINERROR2"+error)
        }
        
    }  
}