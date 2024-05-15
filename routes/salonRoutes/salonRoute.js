const express = require("express");
const router = express.Router();
const {
  subscriptionPlan,
  category,
  serviceType,
  service,
  socialLink,
  jobs
} = require("../../models");
const salonController = require("../../controllers/salonControllers/salonController");
const customerController = require("../../controllers/userControllers/customerController");
const factory = require("../../controllers/handlerFactory");
const validateToken = require("../../middlewares/accessCheck");
const multer = require("multer");
const catchAsync = require("../../middlewares/catchAync");
const path = require("path");

// !Module:1 Auth
router.use(validateToken);
// for taking profile picture of customer
const uploadSalonImgs = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, `./Public/Images`);
  },
  filename: (req, file, cb) => {
    cb(
      null,
      "Service-" +
        req.body.serviceId +
        "-" +
        Date.now() +
        path.extname(file.originalname)
    );
  },
});
const uploadImage = multer({
  storage: uploadSalonImgs,
});

//2. Register salon
router.post(
  "/registration",
  catchAsync(salonController.addSalonDetail)
);
// 2.SubsCription Plan
router.get("/subscriptionPlans", catchAsync(salonController.SubscriptionPlans));
router.post("/AddCard", catchAsync(salonController.addCard));
router.post("/choosePlan", catchAsync(salonController.choosePlan));
router.post("/salonTiming", catchAsync(salonController.salonTiming));
//get Salon Timing
router.get("/getSalonTiming", catchAsync(salonController.getSalonTiming));
// 2.Add Category
router.post("/addCategory", catchAsync(factory.createOne(category)));
// Get All ServiceTypes
router.post("/getServiceTypes", catchAsync(salonController.Types));
// Add Services of Salon
router.post("/addService", catchAsync(factory.createOne(service)));
// Add Images of Salon
router.post("/addServiceImages",uploadImage.array("serviceImges",10), catchAsync(salonController.addImages));
// Add Social Links of Salon
router.post("/addSocialLinks", catchAsync(salonController.addSocialLinks));
// Get All ServiceTypes
router.post("/getAllServices", catchAsync(salonController.getAllServices));

//! Salon profile Edit /Location, Services and social links
// Add Social Links of Salon
router.get("/salonProfile", catchAsync(salonController.salonProfile));
//  Add Salon Gallery Images
const uploadGalleryImgs = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, `./Public/Gallery`);
  },
  filename: (req, file, cb) => {
    cb(
      null,
      "GalleryImg-" +
        req.body.salonDetailId +
        "-" +
        Date.now() +
        path.extname(file.originalname)
    );
  },
});
const uploadGallery = multer({
  storage: uploadGalleryImgs,
});
router.post(
  "/addGalleryImages",
  uploadGallery.fields([{name: 'coverImage', maxCount: 1}, {name: 'portfolioImages', maxCount: 5} ]),
  catchAsync(salonController.addGalleryImages)
);
// Delete Gallery Images
router.post(
  "/deleteGalleryImages",
  catchAsync(salonController.deleteGalleryImages)
);
// Get All ServiceTypes
router.get("/getGalleryImages", catchAsync(salonController.getGalleryImages));
// Update Gallery Images
router.post(
  "/updateGalleryImages",
  uploadGallery.array("galleryImages", 5),
  catchAsync(salonController.updateGalleryImages)
);
// Update Timings
router.patch(
  "/updateSalonTimings",
  catchAsync(salonController.updateSalonTimings)
);
// Update Address
router.patch(
  "/updateSalonAddress",
  catchAsync(salonController.updateSalonAddress)
);
// Update Address
router.patch("/updateService", catchAsync(salonController.updateService));
// Update salonDetail
router.patch("/updateSalonDetail", catchAsync(salonController.updateSalonDetail));
// Update Category
router.patch("/updateCategory", catchAsync(salonController.updateCategory));
// Get Categories
router.get("/getCategories", catchAsync(salonController.getCategories));

router.post("/add-coupon", catchAsync(salonController.addCoupons));
router.get("/coupons", catchAsync(salonController.fecthCoupons));

router.get("/customerSubscription", catchAsync(salonController.customerSubscription));
router.post("/cancelSubscription", catchAsync(salonController.cancelSubscription));
router.post("/addAnotherCard", catchAsync(salonController.addAnotherCard));
router.post("/updateSubscription",catchAsync(salonController.updateSubscription));
router.get("/billingDetail",catchAsync(salonController.billingDetail));
//! Cancelation Policy
router.get("/getCancellationPolicies",catchAsync(salonController.getCancellationPolicies));
router.post("/updateCancellationPolicies",catchAsync(salonController.updateCancellationPolicies));
//! Deposit Policy
router.get("/getDepositPolicies",catchAsync(salonController.getDepositPolicies));
router.post("/updateDepositPolicies",catchAsync(salonController.updateDepositPolicies));
//! No Show Policy
router.get("/getNoShowPolicies",catchAsync(salonController.getNoShowPolicies));
router.post("/updateNoShowPolicies",catchAsync(salonController.updateNoShowPolicies));
//! Reschedule Policy
router.get("/getreschedulePolicy",catchAsync(salonController.getreschedulePolicy));
router.post("/updatereschedulePolicy",catchAsync(salonController.updatereschedulePolicy));
//! Salon History
router.post("/getSalonHistory",catchAsync(salonController.salonHistory));
//! get Booking Details
router.post("/saleDetails", catchAsync(salonController.saleDetails));
//! get Booking Details
router.post("/createOnboardingLink", catchAsync(salonController.createOnboardingLink));
router.post("/accountAdded", catchAsync(salonController.accountAdded));
router.get("/salonWallet", catchAsync(salonController.salonWallet));

//!fornt end payment
router.post("/for-subcription-payment", catchAsync(customerController.forSubcription));

//! Client Feed Back

router.get('/client-feedback/salon/:salon', catchAsync(customerController.clientFeedBack));
router.get('/client-feedback/employee/:employee', catchAsync(customerController.clientFeedBack));
router.get('/client-feedback/customer/:client', catchAsync(customerController.clientFeedBack));
router.get('/client-feedback/appointment/:booking', catchAsync(customerController.clientFeedBack));

module.exports = router;
