const { Op, literal, col, fn, where } = require("sequelize");
const fs = require("fs").promises;
const {
  salonDetail,
  user,
  addressDBS,
  serviceImage,
  employee,
  time,
  category,
  service,
  salonImage,
  serviceType,
  socialLink,
  employeeWagesMethod,
  wagesMethod,
  rating,
  coupon,
  cancellationPolicy,
  depositPolicy,
  noShowPolicy,
  jobs,
  booking,
  wallet,
  reschedulePolicy,
  paymentPolicy
} = require("../../models");
const appError = require("../../utils/appError");
const factory = require("../handlerFactory");
const Convert = require("../../utils/dateManipulation");
const Stripe = require("../stripe");
const dateManipulation = require("../../utils/dateManipulation");

//! Return Function
let returnFunction = (status, message, data, error) => {
  return {
    status: `${status}`,
    message: `${message}`,
    data: data,
    error: `${error}`,
  };
};
/*
            1. Registeration(Salon data)
    ________________________________________
*/
exports.addSalonDetail = async (req, res, next) => {
  const { salonName, description, teamSize, userId, addressDetail } = req.body;
  const addressData = await addressDBS.create(addressDetail);
  const newEntry = await salonDetail.create({
    salonName,
    description,
    teamSize,
    addressDBId: addressData.id,
    userId,
  });
  const durations = [24, 48, 72]; // Durations in hours
  const cancelationPolicies = durations.map((duration) => {
    return {
      hoursBeforeBooking: duration,
      refundPercentage: 10,
      salonDetailId: newEntry.id,
    };
  });
  await cancellationPolicy.bulkCreate(cancelationPolicies);

  await depositPolicy.create({
    salonDetailId: newEntry.id,
  });

  await paymentPolicy.create({
    salonDetailId: newEntry.id,
  });

  await reschedulePolicy.create({
    salonDetailId: newEntry.id,
  });

  await noShowPolicy.create({
    salonDetailId: newEntry.id,
  });
  return res.json(
    returnFunction("1", "Salon Details Added Successfully!", newEntry, "")
  );
};
/*
    Get All Subscription Plans
    __________________________
*/
exports.SubscriptionPlans = async (req, res, next) => {
  const listOfPlans = await Stripe.AllProducts(3);

  return res.json(
    returnFunction("1", "All Subscription Plan", { listOfPlans }, "")
  );
};
/*
    Add Card
    __________________________
*/
exports.addCard = async (req, res, next) => {
  const { userId, cardName, cardExpYear, cardExpMonth, cardNumber, cardCVC } =
    req.body;
  let customerId = await user.findByPk(userId, {
    attributes: ["stripeCustomerId"],
  });
  customerId = customerId.stripeCustomerId;
  const data = {
    customerId,
    userId,
    cardName,
    cardExpYear,
    cardExpMonth,
    cardNumber,
    cardCVC,
  };
  const payment_method = await Stripe.addCard(data);
  return res.json(returnFunction("1", "Card Added Successfully!", {}, ""));
};
/*
            3.Choose SubsCription Plan 
    ________________________________________
*/
exports.choosePlan = async (req, res, next) => {
  const userId = req.user.id;
  const { subscriptionId } = req.body;
  let salonData = await salonDetail.findOne({
    where: { userId },
    include: [{ model: user, attributes: ["stripeCustomerId", "email"] }],
  });
  const subscription = await Stripe.subscriptionsRetrieve(subscriptionId);
  let connectAccount;
  if (!salonData.connectAccountId) {
    connectAccount = await Stripe.createConnectAccount(salonData.user.email);
    salonData.connectAccountId = connectAccount.accountId;
    await salonData.save();
  } 
  const DT = new Date();
  (salonData.approvedByAdmin = true),
    (salonData.registrationDate = dateManipulation.stampToDate(subscription.current_period_start)),
    (salonData.registrationExpiryDate = dateManipulation.stampToDate(subscription.current_period_end));
  salonData.subscriptionPlan = subscription.id;
  await salonData.save();
  const check = await wallet.findOne({
    where: {
      salonDetailId: salonData.id,
    },
  });
  if (!check) {
    await wallet.create({
      salonDetailId: salonData.id,
    });
  }
  return res.json(
    returnFunction(
      "1",
      "All Subscription Plans",
      { salonData, onboardingLink: connectAccount.accountLink.url },
      ""
    )
  );
};
/*
            3.Choose SubsCription Plan 
    ________________________________________
*/
exports.createOnboardingLink = async (req, res, next) => {
  const userId = req.user.id;
  let salonData = await salonDetail.findOne({
    where: { userId },
    include: [{ model: user, attributes: ["stripeCustomerId", "email"] }],
  });

  const onboardingLink = await Stripe.createStripeAccountLink(
    salonData.connectAccountId
  );

  return res.json(
    returnFunction("1", "Onboarding Link", { onboardingLink }, "")
  );
};
/*
            3.Choose SubsCription Plan 
    ________________________________________
*/
exports.accountAdded = async (req, res, next) => {
  const userId = req.user.id;
  let salonData = await salonDetail.findOne({
    where: { userId },
    include: [
      { model: user, attributes: ["stripeCustomerId", "email"] },
      { model: depositPolicy, required: false },
      { model: cancellationPolicy, required: false },
      { model: noShowPolicy, required: false },
    ],
  });
  let salonWallet = await wallet.findOne({
    where: {
      salonDetailId: salonData.id,
    },
  });
  salonWallet.accountConnected = true;
  await salonWallet.save();

  return res.json(
    returnFunction("1", "Account Connected Successfully!", {}, "")
  );
};
/*
            4.Salon Timing 
    ________________________________________
*/
exports.salonTiming = async (req, res, next) => {
  const { salonDetailId, timeData } = req.body;
  timeData.map(async (dat) => {
    const newTime = new time();
    newTime.openingTime =
      dat.openingTime && dat.status
        ? Convert.convertTo24HourFormat(dat.openingTime)
        : !dat.status
          ? null
          : "00:00:01";
    newTime.closingTime =
      dat.closingTime && dat.status
        ? Convert.convertTo24HourFormat(dat.closingTime)
        : !dat.status
          ? null
          : "24:00:00";
    newTime.day = dat.day;
    newTime.salonDetailId = salonDetailId;
    newTime.status = dat.status;
    await newTime.save();
  });

  return res.json(
    returnFunction("1", "Salon Timing Added Succesfully!", {}, "")
  );
};
/*
            4.Get Salon Timing 
    ________________________________________
*/
exports.getSalonTiming = async (req, res, next) => {
  const userId = req.user.id;

  const salonTiming = await time.findAll({
    include: {
      model: salonDetail,
      where: {
        userId,
      },
      attributes: [],
    },
    attributes: {
      exclude: ["createdAt", "updatedAt", "salonDetailId", "employeeId"],
    },
  });
  // Convert opening and closing times to 12-hour format
  salonTiming.forEach((timeSlot) => {
    timeSlot.openingTime =
      timeSlot.openingTime == "00:00:01"
        ? null
        : Convert.convertTo12HourFormat(timeSlot.openingTime);
    timeSlot.closingTime =
      timeSlot.closingTime == "24:00:00"
        ? null
        : Convert.convertTo12HourFormat(timeSlot.closingTime);
  });
  return res.json(returnFunction("1", "Salon Timings", { salonTiming }, ""));
};
/*
            4.Serviece Images 
    ________________________________________
*/
exports.addImages = async (req, res, next) => {
  const { serviceId } = req.body;
  if (!req.files.length) {
    return next(new appError("Images not uploaded, Please upload images", 200));
  }

  let imagesArr = req.files.map((ele) => {
    let tmpPath = ele.path;
    let imagePath = tmpPath.replace(/\\/g, "/");
    let tmpObj = {
      imageUrl: imagePath,
      serviceId,
    };
    return tmpObj;
  });
  const serviceImages = await serviceImage.bulkCreate(imagesArr);
  return res.json(
    returnFunction("1", "Service Images Added Succesfully!", {}, "")
  );
};
/*
            4.Serviece Images 
    ________________________________________
*/
exports.Types = async (req, res, next) => {
  const { salonDetailId } = req.body;
  const serviceTypes = await serviceType.findAll();
  const categories = await category.findAll({
    where: {
      salonDetailId,
    },
  });
  return res.json(
    returnFunction(
      "1",
      "Service & Category Types",
      { serviceTypes, categories },
      ""
    )
  );
};
/*
            4.Add Social Links 
    ________________________________________
*/
exports.addSocialLinks = async (req, res, next) => {
  const { links } = req.body;
  const addLinks = await socialLink.bulkCreate(links);
  return res.json(
    returnFunction("1", "Social Links Added Successfully!", {}, "")
  );
};
/*
            4.Get All Services
    ________________________________________
*/
exports.getAllServices = async (req, res, next) => {
  const { salonDetailId } = req.body;
  const formattedServices = await category.findAll({
    where: {
      salonDetailId,
    },
    include: {
      model: service,
      include: {
        model: category,
        attributes: ["categoryName", "color"],
      },
      attributes: {
        exclude: ["description", "createdAt", "updatedAt"],
      },
    },
    attributes: {
      exclude: ["description", "createdAt", "updatedAt"],
    },
  });
  const allServices = formattedServices.map((category) => {
    const services = category.services.map((service) => {
      const {
        category: { categoryName, color },
        ...rest
      } = service.toJSON();
      return {
        ...rest,
        categoryName,
        color,
      };
    });

    return {
      ...category.toJSON(),
      services,
    };
  });
  return res.json(
    returnFunction("1", "All Salon Services", { allServices }, "")
  );
};
/*
            1. Registeration(Salon data)
    ________________________________________
*/
exports.updateSalonDetail = async (req, res, next) => {
  const userId = req.user.id;
  const { salonName, description } = req.body;
  const salonData = await salonDetail.findOne({
    where: {
      userId,
    },
  });
  if (req.file) {
    let tmpprofileImage = req.file.path;
    let profileImageName = tmpprofileImage.replace(/\\/g, "/");
    fs.unlink(salonData.cover, async (err) => {
      if (err) {
        console.error(`Error deleting file: ${err.message}`);
      } else {
        console.log("Picture Deleted Successfully!");
      }
    });
    await user.update(
      { cover: profileImageName },
      { where: { id: salonData.id } }
    );
  }
  await salonDetail.update(
    {
      salonName,
      description,
    },
    {
      where: {
        userId,
      },
    }
  );

  return res.json(
    returnFunction("1", "Salon Details Updated Successfully!", {}, "")
  );
};
//! Salon profile Edit /Location, Services and social links
/*
            4.Salon Profile 
    ________________________________________
*/
exports.salonProfile = async (req, res, next) => {
  const userId = req.user.id;

  const salonData = await salonDetail.findOne({
    where: {
      userId,
    },
    include: [
      {
        model: user,
        attributes: ["id", "firstName", "lastName", "email"],
      },
      {
        model: socialLink,
        attributes: ["id", "platform", "url"],
      },
      {
        model: rating,
        include: {
          model: user,
          attributes: ["id", "firstName", "lastName", "image"],
        },
        attributes: ["id", "value", "comment", "at", "salonDetailId", "userId"],
      },
      {
        model: salonImage,
        attributes: ["id", "imageUrl", "salonDetailId"],
      },
      {
        model: category,
        required: false,
        include: {
          model: service,
          include: {
            model: category,
            attributes: ["categoryName", "color"],
          },
          attributes: {
            exclude: ["description", "createdAt", "updatedAt"],
          },
        },
        attributes: {
          exclude: ["description", "createdAt", "updatedAt"],
        },
      },
      {
        model: time,
        attributes: ["id", "day", "openingTime", "closingTime", "status"],
      },
      {
        model: addressDBS,
      },
      {
        model: employee,
        include: [
          {
            model: employeeWagesMethod,
            include: { model: wagesMethod, attributes: ["methodName"] },
            attributes: ["id", "value"],
          },
          {
            model: user,
            attributes: ["id", "firstName", "lastName", "image"],
          },
        ],
        attributes: [
          "id",
          "position",
          "description",
          "coverImage",
          "createdAt",
          "updatedAt",
          "userId",
          "salonDetailId",
        ],
      },
    ],
    attributes: {
      exclude: ["subscriptionPlanId"],
    },
  });
  if (!salonData) {
    return next(new appError("Not a salon", 200));
  }
  const avgRating = await rating.aggregate("value", "avg", {
    where: { salonDetailId: salonData.id },
  });
  const review = {
    avgRating,
    total: salonData.ratings.length,
  };

  salonData.times.forEach((timeSlot) => {
    timeSlot.openingTime =
    timeSlot.openingTime == "00:00:01"
      ? "":timeSlot.openingTime == null
      ? ""
      : Convert.convertTo12HourFormat(timeSlot.openingTime);
  timeSlot.closingTime =
    timeSlot.closingTime == "24:00:00"
      ? "":timeSlot.closingTime == null
      ? ""
      : Convert.convertTo12HourFormat(timeSlot.closingTime);
  });
  return res.json(
    returnFunction("1", "Salon Profile", { salonData, review }, "")
  );
};
/*
            4.Salon Gallery Images 
    ________________________________________
*/
exports.addGalleryImages = async (req, res, next) => {
  const { salonDetailId } = req.body;
  if (!req.files) {
    return next(new appError("Images not uploaded, Please upload images", 200));
  }
  // in files one Object in which two arrays(coverImage & portfolioImage)
  if (typeof req.files.coverImage !== "undefined") {
    let tmpLicFrontImage = req.files.coverImage[0].path;
    let coverImage = tmpLicFrontImage.replace(/\\/g, "/");
    await salonDetail.update({ coverImage }, { where: { id: salonDetailId } });
  }

  if (typeof req.files.portfolioImages !== "undefined") {
    let imagesArr = req.files.portfolioImages.map((ele) => {
      let tmpPath = ele.path;
      let imagePath = tmpPath.replace(/\\/g, "/");
      let tmpObj = {
        imageUrl: imagePath,
        salonDetailId,
      };
      return tmpObj;
    });
    const Gallery = await salonImage.bulkCreate(imagesArr);
  }

  return res.json(
    returnFunction("1", "Gallery Images Added Succesfully!", {}, "")
  );
};
/*
            4.Salon Gallery Images 
    ________________________________________
*/
exports.getGalleryImages = async (req, res, next) => {
  const userId = req.user.id;
  const salonData = await salonDetail.findOne({
    where: {
      userId,
    },
  });
  const galleryImages = await salonImage.findAll({
    where: {
      salonDetailId: salonData.id,
    },
  });
  return res.json(
    returnFunction("1", "All Gallery Images !", { galleryImages }, "")
  );
};
/*
            4.Update Salon Gallery Images 
    ________________________________________
*/
exports.deleteGalleryImages = async (req, res, next) => {
  const { ImageId } = req.body;
  let SalonImage = await salonImage.findByPk(ImageId);
  fs.unlink(SalonImage.imageUrl, async (err) => {
    if (err) {
      console.error(`Error deleting file: ${err.message}`);
    } else {
      console.log("Picture Deleted Successfully!");
    }
  });
  await salonImage.destroy({
    where: {
      id: ImageId,
    },
  });
  return res.json(returnFunction("1", "Picture Deleted Successfully!", {}, ""));
};
/*
            4.Update Salon Gallery Images 
    ________________________________________
*/
exports.updateGalleryImages = async (req, res, next) => {
  const { salonDetailId } = req.body;
  if (req.files.length > 0) {
    let imagesArr = req.files.map((ele) => {
      let tmpPath = ele.path;
      let imagePath = tmpPath.replace(/\\/g, "/");
      let tmpObj = {
        imageUrl: imagePath,
        salonDetailId,
      };
      return tmpObj;
    });
    const Gallery = await salonImage.bulkCreate(imagesArr);
  }

  return res.json(
    returnFunction("1", "Gallery Images Updated Succesfully!", {}, "")
  );
};
/*
            4.Update Salon Timings
    ________________________________________
*/
exports.updateSalonTimings = async (req, res, next) => {
  const { salonDetailId, timeData } = req.body;

  timeData.map(async (dat) => {
    let timeTable = await time.findOne({
      where: [{ salonDetailId }, { day: dat.day }],
    });
    if (timeTable) {
      timeTable.openingTime =
        dat.openingTime && dat.status
          ? Convert.convertTo24HourFormat(dat.openingTime)
          : !dat.status
            ? null
            : "00:00:01";
      timeTable.closingTime =
        dat.closingTime && dat.status
          ? Convert.convertTo24HourFormat(dat.closingTime)
          : !dat.status
            ? null
            : "24:00:00";
      timeTable.status = dat.status;
      await timeTable.save();
    } else {
      const newTime = new time();
      newTime.openingTime =
        dat.openingTime && dat.status
          ? Convert.convertTo24HourFormat(dat.openingTime)
          : !dat.status
            ? null
            : "00:00:01";
      newTime.closingTime =
        dat.closingTime && dat.status
          ? Convert.convertTo24HourFormat(dat.closingTime)
          : !dat.status
            ? null
            : "24:00:00";
      newTime.day = dat.day;
      newTime.salonDetailId = salonDetailId;
      await newTime.save();
    }
  });
  return res.json(
    returnFunction("1", "Salon Timings Updated Successfully!", {}, "")
  );
};
/*
            4.Update Salon Timings
    ________________________________________
*/
exports.updateSalonAddress = async (req, res, next) => {
  const {
    building,
    floor,
    apartment,
    streetAddress,
    district,
    postalCode,
    addressDBId,
  } = req.body;
  const addressExist = await addressDBS.findOne({
    where: { id: addressDBId },
  });
  if (!addressExist) throw new CustomException("user address not Exist!");
  const updatedData = await addressDBS.update(
    { building, floor, apartment, streetAddress, district, postalCode },
    { where: { id: addressDBId } }
  );
  // userAddress.update({default: true}, {where: {id: attchedAddressId}});
  return res.json(returnFunction("1", "Address updated successfully", {}, ""));
};
/*
            5.Update Salon Service
    ________________________________________
*/
exports.updateService = async (req, res, next) => {
  const {
    serviceId,
    salonDetailId,
    serviceName,
    price,
    duration,
    description,
    categoryId,
    serviceTypeId,
  } = req.body;
  let Service = await service.findByPk(serviceId);
  if (!Service) {
    return res.json(returnFunction("1", "No Service Found!", {}, ""));
  }
  Service.serviceName = serviceName ? serviceName : Service.serviceName;
  Service.price = price ? price : Service.price;
  Service.duration = duration ? duration : Service.duration;
  Service.description = description ? description : Service.description;
  Service.categoryId = categoryId ? categoryId : Service.categoryId;
  Service.serviceTypeId = serviceTypeId ? serviceTypeId : Service.serviceTypeId;
  await Service.save();

  return res.json(
    returnFunction("1", "Salon Services Updated Successfully!", {}, "")
  );
};
/*
            5.Get Salon Categories
    ________________________________________
*/
exports.getCategories = async (req, res, next) => {
  const userId = req.user.id;
  const categories = await category.findAll({
    include: {
      model: salonDetail,
      where: {
        userId,
      },
      attributes: [],
    },
  });
  return res.json(
    returnFunction("1", "All Categories of Salon", { categories }, "")
  );
};
/*
            5.Update Salon Category
    ________________________________________
*/
exports.updateCategory = async (req, res, next) => {
  const { categoryName, color, id } = req.body;
  await category.update(
    {
      categoryName,
      color,
    },
    {
      where: { id },
    }
  );

  return res.json(
    returnFunction("1", "Salon Category Updated Successfully!", {}, "")
  );
};
//! Coupon
/*
            6.Fetch Coupons
    ________________________________________
*/
exports.fecthCoupons = async (req, res, next) => {
  const salon = await salonDetail.findOne({ where: { userId: req.user.id } });
  if (!salon) {
    return res.status(200).json(returnFunction("0", "Data Not found.", {}, ""));
  }
  const results = await coupon.findAll({
    where: { salonDetailId: salon.id },
    attributes: [
      `id`,
      `promoCode`,
      `type`,
      `status`,
      `limit`,
      `from`,
      `till`,
      "value",
      `createdAt`,
    ],
    order: [["id", "DESC"]],
  });

  return res
    .status(200)
    .json(returnFunction("1", "All Coupons.", { coupons: results }, ""));
};
/*
            6.Add Coupons
    ________________________________________
*/
exports.addCoupons = async (req, res, next) => {
  const input = req.body;
  const salon = await salonDetail.findOne({ where: { userId: req.user.id } });
  const exist = await coupon.findOne({ where: { promoCode: input.promoCode } });
  if (exist) {
    return res
      .status(200)
      .json(returnFunction("0", "Promo code already taken.", {}, ""));
  }
  if (!salon) {
    return res.status(200).json(returnFunction("0", "Data Not found.", {}, ""));
  }

  input.salonDetailId = salon.id;
  await coupon.create(input);

  return res
    .status(200)
    .json(returnFunction("1", "Coupon created Successfully!", {}, ""));
};
//! Subscription
/*
    Get Customer Subscription Plans
    __________________________
*/
exports.customerSubscription = async (req, res, next) => {
  const userId = req.user.id;
  const salonData = await salonDetail.findOne({
    where: {
      userId,
    },
  });
  if (!salonData.subscriptionPlan) {
    return res.json(returnFunction("2", "No Subcription Plan", {}, ""));
  }
  const customerSubscription = await Stripe.getSubscription(
    salonData.subscriptionPlan
  );

  customerSubscription.expire = salonData.registrationExpiryDate;
  return res.json(
    returnFunction("1", "All Subscription Plan", { customerSubscription }, "")
  );
};
/*
    Cancel Customer Subscription Plans
    __________________________
*/
exports.cancelSubscription = async (req, res, next) => {
  const userId = req.user.id;
  let salonData = await salonDetail.findOne({
    where: {
      userId,
    },
  });
  const cancelSubscription = await Stripe.cancelSubscription(
    salonData.subscriptionPlan
  );
  if (cancelSubscription) {
    salonData.subscriptionPlan = null;
    await salonData.save();
  }
  return res.json(
    returnFunction("1", "subscription has been canceled", {}, "")
  );
};
/*
    Add Another Card
    __________________________
*/
exports.addAnotherCard = async (req, res, next) => {
  const userId = req.user.id;
  const { cardName, cardExpYear, cardExpMonth, cardNumber, cardCVC } = req.body;
  let customerId = await user.findByPk(userId, {
    attributes: ["stripeCustomerId"],
  });
  customerId = customerId.stripeCustomerId;
  const data = {
    customerId,
    userId,
    cardName,
    cardExpYear,
    cardExpMonth,
    cardNumber,
    cardCVC,
  };
  const payment_method = await Stripe.addCard(data);
  return res.json(
    returnFunction("1", "Card Added Successfully!", { payment_method }, "")
  );
};
/*
    Renew Customer Subscription Plans
    __________________________
*/
exports.updateSubscription = async (req, res, next) => {
  const userId = req.user.id;
  const { priceId, paymentMethodId } = req.body;
  let salonData = await salonDetail.findOne({
    where: {
      userId,
    },
    include: {
      model: user,
      attributes: ["stripeCustomerId"],
    },
  });
  const customerId = salonData.user.stripeCustomerId;
  const updateSubscription = await Stripe.updateSubscription(
    salonData.subscriptionPlan,
    priceId,
    customerId,
    paymentMethodId
  );
  (salonData.registrationDate = updateSubscription.current_period_start),
    (salonData.registrationExpiryDate = updateSubscription.current_period_end);
  salonData.subscriptionPlan = updateSubscription.id;
  await salonData.save();
  return res.json(returnFunction("1", "Update Subscription Plan", {}, ""));
};
//! Wallet
/*
            6.Fetch Wallet
    ________________________________________
*/
exports.billingDetail = async (req, res, next) => {
  const salon = await salonDetail.findOne({ where: { userId: req.user.id } });
  if (!salon) {
    return res.status(200).json(returnFunction("0", "Data Not found.", {}, ""));
  }
  const results = await Stripe.subscriptionInvoices(salon.subscriptionPlan);

  return res
    .status(200)
    .json(
      returnFunction(
        "1",
        "All Coupons.",
        { Invoices: results, teamSize: salon.teamSize },
        ""
      )
    );
};

//! Cancelation Policy
/*
    Get Cancellation Policies
    __________________________
*/
exports.getCancellationPolicies = async (req, res) => {
  const userId = req.user.id;
  // Find the salon by ID
  const salon = await salonDetail.findOne({
    where: {
      userId,
    },
  });

  if (!salon) {
    return res.status(200).json(returnFunction("0", "Salon not found", {}, ""));
  }

  // Find cancellation policies associated with the salon
  const cancellationPolicies = await cancellationPolicy.findAll({
    where: {
      salonDetailId: salon.id, // Assuming there's a foreign key in the CancellationPolicy model named salonId
    },
  });

  return res
    .status(200)
    .json(
      returnFunction(
        "1",
        "Salon cancellation Policy",
        { cancellationPolicies },
        ""
      )
    );
};
/*
    Update Cancellation Policies
    __________________________
*/
exports.updateCancellationPolicies = async (req, res) => {
  const { cancelationPolicies } = req.body;

  const cancelationPolicy = cancelationPolicies.map(async (ele) => {
    await cancelationPolicies.update(
      {
        refundPercentage: ele.refundPercentage,
      },
      {
        where: {
          id: ele.id,
        },
      }
    );
  });

  return res
    .status(200)
    .json(returnFunction("1", "Salon cancellation Policy Updated!", {}, ""));
};
//! Deposit Policy
/*
    Get Deposit Policies
    __________________________
*/
exports.getDepositPolicies = async (req, res) => {
  const userId = req.user.id;
  // Find the salon by ID
  const salon = await salonDetail.findOne({
    where: {
      userId,
    },
  });

  if (!salon) {
    return res.status(200).json(returnFunction("0", "Salon not found", {}, ""));
  }

  // Find cancellation policies associated with the salon
  const depositPolicies = await depositPolicy.findOne({
    where: {
      salonDetailId: salon.id, // Assuming there's a foreign key in the CancellationPolicy model named salonId
    },
  });

  return res
    .status(200)
    .json(returnFunction("1", "Salon Deposit Policy", { depositPolicies }, ""));
};
/*
    Update Cancellation Policies
    __________________________
*/
exports.updateDepositPolicies = async (req, res) => {

  const { id, refundPercentage } = req.body;
  const userId = req.user.id;
  // Find the salon by ID
  const salon = await salonDetail.findOne({
    where: {
      userId,
    },
  });

  await depositPolicy.update(
    {
      refundPercentage: refundPercentage,
    },
    {
      where: {
        id,
      },
    }
  );

  const exist  = await paymentPolicy.findOne({where:{salonDetailId:salon.id}})
  
  if (exist) {
    await paymentPolicy.create({percentage: refundPercentage, salonDetailId:salon.id});
  }else{
    await paymentPolicy.update(
      {
        percentage: refundPercentage,
      },
      {
        where: {
          salonDetailId:salon.id,
        },
      }
    );
  }

  return res
    .status(200)
    .json(returnFunction("1", "Salon Deposit Policy Updated!", {}, ""));
};
//! No Show Policy
/*
    Get Deposit Policies
    __________________________
*/
exports.getNoShowPolicies = async (req, res) => {
  const userId = req.user.id;
  // Find the salon by ID
  const salon = await salonDetail.findOne({
    where: {
      userId,
    },
  });

  if (!salon) {
    return res.status(200).json(returnFunction("0", "Salon not found", {}, ""));
  }

  // Find cancellation policies associated with the salon
  const noShowPolicies = await noShowPolicy.findOne({
    where: {
      salonDetailId: salon.id, // Assuming there's a foreign key in the CancellationPolicy model named salonId
    },
  });

  return res
    .status(200)
    .json(returnFunction("1", "Salon No Show Policy", { noShowPolicies }, ""));
};
/*
    Update Cancellation Policies
    __________________________
*/
exports.updateNoShowPolicies = async (req, res) => {
  const { id, refundPercentage } = req.body;

  await noShowPolicy.update(
    {
      refundPercentage: refundPercentage,
    },
    {
      where: {
        id,
      },
    }
  );

  return res
    .status(200)
    .json(returnFunction("1", "Salon No Show Policy Updated!", {}, ""));
};
//! Reschedule Policy
/*
    Get Deposit Policies
    __________________________
*/
exports.getreschedulePolicy = async (req, res) => {
  const userId = req.user.id;
  // Find the salon by ID
  const salon = await salonDetail.findOne({
    where: {
      userId,
    },
  });

  if (!salon) {
    return res.status(200).json(returnFunction("0", "Salon not found", {}, ""));
  }

  // Find cancellation policies associated with the salon
  const reschedulePolicies = await reschedulePolicy.findOne({
    where: {
      salonDetailId: salon.id, // Assuming there's a foreign key in the CancellationPolicy model named salonId
    },
  });

  return res
    .status(200)
    .json(returnFunction("1", "Salon Reschedule Policy", { reschedulePolicy:reschedulePolicies }, ""));
};
/*
    Update Cancellation Policies
    __________________________
*/
exports.updatereschedulePolicy = async (req, res) => {
  const { id, hoursBeforeBooking,count } = req.body;

  await reschedulePolicy.update(
    {
      hoursBeforeBooking,
      count
    },
    {
      where: {
        id,
      },
    }
  );

  return res
    .status(200)
    .json(returnFunction("1", "Salon Reschedule Policy Updated!", {}, ""));
};
// ! Booking History
/*
   Salon Booking History
    __________________________
*/
exports.salonHistory = async (req, res) => {
  const userId = req.user.id;
  const { time } = req.body;

  // Calculate the date one week ago
  const timeAgo = new Date();
  timeAgo.setDate(timeAgo.getDate() - time);

  const salonHistory = await booking.findAll({
    where: {
      createdAt: {
        [Op.gte]: timeAgo,
      },
      status: {
        [Op.in]: ["complete", "cancel", "no-show"],
      },
    },
    include: [
      {
        model: salonDetail,
        where: {
          userId,
        },
        attributes: [],
      },
    ],
    attributes: ["id", "createdAt", "total", "status", "on"],
  });

  return res
    .status(200)
    .json(returnFunction("1", "Salon Booking History", { salonHistory }, ""));
};
/*
              4.Booking Details
      ________________________________________
  */
exports.saleDetails = async (req, res, next) => {
  const { bookingId } = req.body;
  let bookings = [];
  const bookingData = await booking.findOne({
    where: { id: bookingId },
    include: [
      {
        model: user,
        attributes: [
          "id",
          "firstName",
          "lastName",
          "countryCode",
          "phoneNum",
          "image",
          "email",
        ],
      },
      {
        model: jobs,
        include: [
          { model: service, attributes: ["serviceName", "price"] },
          {
            model: employee,
            required: false,
            include: [
              {
                model: user,
                attributes: ["id", "firstName", "lastName", "image"],
              },
              {
                model: rating,
                attributes: ["value"],
                separate: true,
                required: false,
              },
            ],
            attributes: ["id", "position"],
          },
        ],
      },
    ],
  });
  const employeeMap = bookingData.jobs.reduce((acc, ele) => {
    const employeeId = ele.employee ? ele.employee.id : "AnyOne";
    if (!acc[employeeId]) {
      acc[employeeId] = {
        employee: ele.employee,
        services: [],
      };
    }

    acc[employeeId].services.push({
      id: ele.id,
      status: ele.status,
      serviceName: ele.service.serviceName,
      price: ele.service.price,
      startTime: dateManipulation.convertTo12HourFormat(ele.startTime),
      duration: ele.duration,
      endTime: dateManipulation.convertTo12HourFormat(ele.endTime),
      extra: ele.Extra,
    });

    return acc;
  }, {});

  const promises = Object.values(employeeMap).map(async (employeeObj) => {
    return employeeObj;
  });
  const employees = await Promise.all(promises);
  let bookingDetail = {
    id: bookingData.id,
    scheduleDate: bookingData.on,
    client: `${bookingData.user.firstName} ${bookingData.user.lastName}`,
    profile: bookingData.user.image,
    email: bookingData.user.email,
    Phone: `${bookingData.user.countryCode}${bookingData.user.phoneNum}`,
    Upfront: bookingData.initialPayment,
    duration: bookingData.duration,
    initialPayment: bookingData.initialPayment,
    total: bookingData.total,
    customerId: bookingData.customerId,
    employees,
  };
  return res.json(
    returnFunction("1", "Booking Details", { bookingDetail }, "")
  );
};
/*
              4.Booking Details
      ________________________________________
  */
exports.salonWallet = async (req, res, next) => {
  const userId = req.user.id;
  const salonData = await salonDetail.findOne({
    where: {
      userId,
    },
  });
  const salonWallet = await wallet.findOne({
    where: {
      salonDetailId: salonData.id,
    },
  });

  return res.json(returnFunction("1", "Salon Wallet", { salonWallet }, ""));
};



