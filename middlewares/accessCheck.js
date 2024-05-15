require('dotenv').config();
const { verify } = require('jsonwebtoken');
const {deviceToken} = require("../models");

module.exports = async function validateToken(req, res, next) {
  try {
    const acccessToken = req.header('accessToken');
    //If no token -- Throw Error
    if (!acccessToken) throw new Error();
    // Verify Token , If not auto Throw Error
    const validToken = verify(acccessToken, process.env.JWT_ACCESS_SECRET);
    req.user = validToken;
    const check = await deviceToken.findOne({
      where: { tokenId: req.user.dvToken},//not working for employee cause we pass salon id in employee accessToken ,userId: req.user.id 
    });
    if(!check){
      return res.json({
        status: '0',
        message: 'Access Denied',
        data: {},
        error: 'You are not authorized to access it'
      });
    }
    next();
  } catch (error) {
    return res.json({
      status: '0',
      message: 'Access Denied',
      data: {},
      error: 'You are not authorized to access it'
    });
  }
};
