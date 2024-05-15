
const dotenv = require('dotenv');
dotenv.config({ path: '../.env' });
const { CURRENCY_UNIT,STRIPE_PUBLISHABLE_KEY,STRIPE_SECRET_KEY } = process.env;
 
const { Op, literal, col, fn, where} = require('sequelize');

const {
  user,
  salonDetail,
  rating,
  addressDBS,
  category,
  service,
  salonImage,
  employee,
  time,
  employeeService,
  jobs,
  booking,
  socialLink,
  coupon,
  favorite,
  paymentPolicy,
  cancellationPolicy,
  depositPolicy,
  noShowPolicy,
  reschedulePolicy,

} = require('../../models');
const AppError = require('../../utils/appError');
const Slot = require('../../utils/timeSlots');
const Custom = require('../../utils/customFunctions');
const Stripe = require('../stripe');
const ThrowNotification = require("../../utils/throwNotification");
const DateManupulation = require('../../utils/dateManipulation');
const { use } = require('../../routes/salonRoutes/reportsRoute');
const CustomDate = require('../../utils/currentDay');
 
const EmailAppointmentConfirmToSalon = require('../../helper/AppointmentConfirmToSalon');
const EmailAppointmentConfirmToCustomer = require('../../helper/AppointmentConfirmToCustomer');
const EmailResetPasswordOtpToAll = require('../../helper/ResetPasswordOtpToAll');
 
//Global Variables
const currentDate = new Date();
console.log("🚀 ~ currentDate:", currentDate)
const year = currentDate.getFullYear();
const month = String(currentDate.getMonth() + 1).padStart(2, '0'); // Adding 1 to month and formatting to have leading zero if needed
const day = String(currentDate.getDate()).padStart(2, '0'); // Formatting day to have leading zero if needed

const currentDateOnly = `${year}-${month}-${day}`;

 
//! Return Function
const response = ({ status, message, data, error }) => {
  return {
    status: status ? `${status}` : '1',
    message: message ? `${message}` : 'success',
    data: data||{},
    error: error ? `${error}` : ''
  };
};

exports.emailtesting = async (req, res, next) => {
  const {email} = req.body;
 const appointment = await booking.findOne({
   attributes:['id','status', 'on','total','startTime','actualCapturedAmount'],
  include:[
    { 
      model : salonDetail ,
      attributes:['salonName'],
      include:{model:addressDBS,attributes:['streetAddress','city','district','province','country']}
    },
    { 
      model : user , 
      attributes:['firstName','lastName','email','countryCode','phoneNum'],
    },
    {
      model:jobs,
      attributes:['id','total','on','startTime','duration'],
      include:[
        { model : service ,attributes:['serviceName']},
        {
          model : employee, attributes:['position'],
          include:{model:user, attributes : ['firstName','lastName']}
        },
      ],
    }
  ]
 })
   EmailAppointmentConfirmToCustomer(['sigidevelopers@gmail.com'],appointment); 
  //  EmailResetPasswordOtpToAll(['sigidevelopers@gmail.com'],appointment)
   return res.status(200).json(response({data:appointment}));
};

//* 1.Get Home ----------------------

exports.home = async (req, res, next) => {
  const currentDay = CustomDate.currentDay();
  const {targetLat,targetLng} = req.body;
  const rangeInKm = req.body.rangeInKm || 15;
const condition = {status:true}  
const priceCondition = req.body.price?{
  price :{
  [Op.lte]: req.body.price,
}
}:{};
  if (req.body.day && req.body.time) {
     condition.day = req.body.day;
     condition.openingTime= {
      [Op.lte]: req.body.time,
    };
    condition.closingTime = {
       [Op.gte]: req.body.time,
     };
  }
  const likedSalons = await favorite.findAll({where:{userId:req.user.id},attributes:['salonDetailId']}); 
  const likeIds = likedSalons.length > 0 ?likedSalons.map(ele => ele.salonDetailId):[];
  console.log("🚀 ~ exports.home= ~ likeIds:", likeIds)
  const salonCondition = {
    registrationExpiryDate: { [Op.gt]: currentDay.currentDateOnly },
    approvedByAdmin: true
  }
  if (req.params.favorite && req.user ) {
    if (likedSalons.length < 1) {
      const output = {data:{slons:[]}};
      return res.status(200).json(response(output));
    }
    salonCondition.id = {[Op.or]: likeIds};
   console.log("🚀 ~ exports.home= ~ likeIds:", likeIds)
  }
    const formula  = `(
      6371 * 
      acos(
        cos(radians(${targetLat})) * cos(radians(lat)) * 
        cos(radians(lng) - radians(${targetLng})) + 
        sin(radians(${targetLat})) * sin(radians(lat))
      )
    )`;

    const body = {
      where: salonCondition,
      attributes: [
        'id',
        'salonName',
        'coverImage',
        [literal('FORMAT(AVG(ratings.value), 1)'), 'salonAverageRating'],
        [fn('COUNT', col('ratings.id')), 'ratingCount'],
      ],
      include: [
        {
          model: rating,
          attributes: [],
          on: { 'salonDetailId': col('salonDetail.id') },
          required: false  
        },
        {
          model: time,
          where : condition,
          required: true,  
          attributes: ['day', 'openingTime', 'closingTime'],
        },
        {
          model: addressDBS,
          required: true,
          attributes: [
            'id',
            'streetAddress',
            'city',
            'district',
            'province',
            'country',
            'lat',
            'lng'
          ]
        },
        {
          model: service,
          where:priceCondition,
          required: true, 
          attributes: ['id', 'serviceName', 'price', 'duration', 'discount']
        }
      ],
      group: ['salonDetail.id','times.id','services.id'],  
      having: literal(`${formula}<= ${rangeInKm}`),
    }
    if(req.params.favorite){
       delete body.having
      }else{
        body.attributes.push([literal(`${formula}`),'distance'])
      };

    let results = await salonDetail.findAll(body);

    results =JSON.parse(JSON.stringify(results))
    if(results.length > 0){
      results = results.map(salon => {
        const found = likeIds.some(id => id === salon.id);
        return { ...salon, "like": found };
    });
    }
    console.log("🚀 ~ exports.home= ~ results:", results)
    let appointments = [];
    if (req.user && req.user.id) {
      appointments = await booking.findAll({
        where:{customerId:req.user.id , status: {[Op.or]:['pending','book']}},
        attributes:['id',`status`, `startTime`, `on`,'total','actualCapturedAmount',
        [
          literal(`(SELECT COUNT(*) FROM jobs WHERE jobs.bookingId = booking.id)`),
          'serviceCount'
        ],
      ],
        
        include:[
          {
            model:salonDetail, attributes:['id', `salonName`,'coverImage',
            // [literal('FORMAT(AVG(ratings.value), 1)'), 'salonAverageRating'],
            // [fn('COUNT', col('ratings.id')), 'ratingCount']
          ],
            include:[
              {model:addressDBS,attributes:[`streetAddress`,`city`]},
              {model:rating,attributes:[]}
            ]
          },
          {
          model:jobs,
          attributes:[],
        }]
      });
    }

  
    const output = {data:{slons:results,appointments,currencyUnit:CURRENCY_UNIT, distanceUnit:'km'}};
    if(req.params.favorite){
      output.data= {slons:results}
    }

  return res.status(200).json(response(output));

};

//* 2.Get Salon Details -----------------

exports.salonDetails = async (req, res, next) => {
  const currentDay = CustomDate.currentDay();
  const results = await salonDetail.findByPk(req.params.id, {
    where: {
      registrationExpiryDate: { [Op.gt]: currentDay.currentDateOnly }, 
      approvedByAdmin: true
    },
    attributes: [
      'id',
      'salonName',
      'coverImage',
      'description',
      [
        literal(
          '(SELECT FORMAT(AVG(ratings.value), 1) FROM ratings WHERE ratings.salonDetailId = salonDetail.id)'
        ),
        'salonAverageRating'
      ],
      [
        literal(
          '(SELECT COUNT(ratings.id) FROM ratings WHERE ratings.salonDetailId = salonDetail.id)'
        ),
        'ratingCount'
      ]
    ],
    include: [
      {
        model: rating,
        limit: 10,
        required: false,
        attributes: ['id', 'value', 'comment', 'createdAt'],
        include: {
          model: user,
          attributes: ['firstName', 'lastName', 'image']
        }
      },
      {
        model: socialLink,
        required: false,
        attributes: [`id`, `platform`, `url`]
      },
      {
        model: addressDBS,
        attributes: [
          'id',
          'streetAddress',
          'city',
          'district',
          'province',
          'country',
          'lat',
          'lng'
        ]
      },
      {
        model: category,
        attributes: ['id', 'categoryName', 'color'],
        include: {
          model: service,
          attributes: ['id', 'serviceName','description', 'price', 'duration', 'discount']
        }
      },
      {
        model: salonImage,
        attributes: ['imageUrl']
      },
      {
        model: time,
        attributes: ['status','day', 'openingTime', 'closingTime']
      },
      {
        model: employee,
        attributes: [
          'position',
          [ 
            literal(
              '(SELECT FORMAT(AVG(ratings.value), 1) FROM ratings WHERE ratings.employeeId = employees.id)'
            ),
            'employeeAverageRating'
          ]
        ],
        include: [
          {
            model: rating,
            attributes: []
          },
          {
            model: user,
            attributes: ['id', `firstName`, `lastName`, 'image']
          }
        ]
      },
     
    ]
  });
 
  let like = false;
 
  if (req.user) {
    const likedSalon = await favorite.findOne({where:{userId:req.user.id,salonDetailId:req.params.id},attributes:['salonDetailId']}); 
    if (likedSalon) like = true 
  }
  const policies = await  salonDetail.findOne({
    where:{id:req.params.id},
    attributes:['id','salonName'],
    include:[
      {model:cancellationPolicy, attributes:{ exclude: ['createdAt','updatedAt','salonDetailId'] }},
      {model:depositPolicy, attributes:{ exclude: ['createdAt','updatedAt','salonDetailId'] }},
      {model:noShowPolicy, attributes:{ exclude: ['createdAt','updatedAt','salonDetailId'] }},
      {model:reschedulePolicy, attributes:{ exclude: ['createdAt','updatedAt','salonDetailId'] }},
      {model:paymentPolicy, attributes:{ exclude: ['createdAt','updatedAt','salonDetailId'] }},
    ]
  })
  return res.status(200).json(response({data:{like,detail:results,policies,currencyUnit:CURRENCY_UNIT}}));
};

//* 3.Salon Times

exports.salonTimes = async (req, res, next) => {
  const {salon} = req.params;
  const data = await time.findAll({
    where: {salonDetailId:salon},
    attributes: ['status','day', 'openingTime', 'closingTime']
  });

  return res.status(200).json(response({data:{times:data} }));
};

//* 4 .Get Employee Times -----------------

exports.employeeTimes = async (req, res, next) => {
  const {employee} = req.params;
  const data = await time.findAll({
    where: { employeeId:employee},
    attributes: ['status','day', 'openingTime', 'closingTime']
  });

  return res.status(200).json(response({data:{times:data} }));
};

//* 2.Get Employee Details -----------------

exports.employeeDetails = async (req, res, next) => {
  const results = await user.findByPk(req.params.id, {
    attributes: ['firstName', 'lastName', 'image'],
    include: [
      {
        model: employee,
        attributes: [
          'id',
          'position',
          'coverImage',
          'description',
          [
            literal(
              '(SELECT FORMAT(AVG(ratings.value), 1) FROM ratings WHERE ratings.employeeId = employees.id)'
            ),
            'employeeAverageRating'
          ],
          [
            literal(
              '(SELECT COUNT(ratings.id) FROM ratings WHERE ratings.employeeId = employees.id)'
            ),
            'totalRatings'
          ]
        ],
        include: [
          {
            model: rating,
            attributes: []
          },
          {
            model: employeeService,
            attributes: ['status'],
            include: [
              {
                model: service,
                attributes: [
                  'id',
                  'serviceName',
                  'description',
                  'price',
                  'duration',
                  'discount'
                ]
              }
            ]
          },
          {
            model: time,
            attributes: ['status','day', 'openingTime', 'closingTime']
          }
        ]
      }
    ]
  });

  console.log(results)
  
  const output = results.toJSON();
  output.employee = output.employees[0];
  delete output.employees;

  return res.status(200).json(response({data:{detail:output,currencyUnit:CURRENCY_UNIT}}));
};

//* 2.Check User Session -----------------

exports.session = async (req, res, next) => {
  const accessToken = req.header('accessToken');
  const userId = req.user.id;
  const data = await user.findByPk(userId, {
    attributes: ['id', 'firstName', 'lastName', 'email', 'status','image','stripeCustomerId']
  });
  if (data.status === false)
    next(new AppError('Blocked by Admin. Contact customer support'));

  const output = JSON.parse(JSON.stringify(data));  
  output.accessToken = accessToken;
  output.userId = `${userId}`;
  delete output.id;
   return res.status(200).json(response({data:output }));
};

//~ AppointMent Journey Start
//* 1.Find Employees That provides all selected services -----------------

exports.employeesWithAllServices = async (req, res, next) => {
  const {services} = req.body;
  const employeesWithServices = await employeeService.findAll({
    where: {
      salonDetailId:req.params.salon,
      serviceId: {
        [Op.in]: services
      }
    },
    attributes: ['employeeId'],
    group: ['employeeId'],
    having:literal(`COUNT(DISTINCT serviceId) = ${services.length}`)
  });
  
  const employeeIds = employeesWithServices.length>0?employeesWithServices.map(employeeService => employeeService.employeeId):[];
  console.log("ðŸš€~employees:", employeeIds)
  if (employeeIds.length < 1) {
    return res.status(200).json({status:'2',message:'No employee available move forword.'});
  }
  
  const workers = await user.findAll({
    attributes: ['firstName', 'lastName', 'image'],
    include: [
      {
        model: employee,
        where:{id:employeeIds,salonDetailId:req.params.salon},
        attributes: [
          'id',
          'position',
          [
            literal(
              '(SELECT FORMAT(AVG(ratings.value), 1) FROM ratings WHERE ratings.employeeId = employees.id)'
            ),
            'employeeAverageRating'
          ],
          [
            literal(
              '(SELECT COUNT(ratings.id) FROM ratings WHERE ratings.employeeId = employees.id)'
            ),
            'totalRatings'
          ]
        ],
        include: [
          {
            model: rating,
            attributes: []
          },
          {
            model: time,
            where: { status: true },
            attributes: ['day', 'openingTime', 'closingTime']
          }
        ]
      }
    ]
  });
  if (!workers || workers.length < 1) {
    return res.status(200).json({status:'2',message:'No employee available move forword.'});
  }
  
  const result =  workers.map(ele => {
    const obj = ele.toJSON();
    obj.employee = obj.employees[0];
    delete obj.employees;
    return obj
  })

  const output = response({data:{employees:result}});
  return res.status(200).json(output);
};


//* 2.Check Employees availability -----------------

exports.employeeAvailability = async (req, res, next) => {
  const {openingTime,closingTime,jobDate,duration} = req.body;

  const busyTimes = await jobs.findAll({
    where:{status:'assign', employeeId:req.params.employee},
    attributes:['startTime','endTime']
  })
 
  const availableTimeSlots = Slot.getAvailableTimeSlots(jobDate, openingTime, closingTime, duration, busyTimes);

  const output = response({data:{availableTimeSlots}}); 
  return res.status(200).json(output);

};

//* 3.Check Employees availability -----------------

exports.salonAvailability = async (req, res, next) => {
  const {openingTime,closingTime,jobDate,duration} = req.body;

  const salon = await salonDetail.findOne({
    where:{id:req.params.salon},
    attributes:['id']
  })
  if (!salon) throw new AppError('resource not Found',200);

  const availableTimeSlots = Slot.getAvailableTimeSlots(jobDate, openingTime, closingTime, duration, []);

  const output = response({data:{availableTimeSlots}}); 
  return res.status(200).json(output);

};

//* 4.Reschedule Solo Employee Appointment -----------------

exports.rescheduleSoloEmployeeAppointment = async (req, res, next) => {
  const {bookingId} = req.params;
  const {appointment,services,employeeId} = req.body;
  appointment.startTime = DateManupulation.convertTo24HourFormat(appointment.startTime)
  console.log("🚀 ~ AFTER START-TIME", appointment.startTime)
 
  appointment.endTime = DateManupulation.convertTo24HourFormat(appointment.endTime)
  const appointmentDate = new Date(appointment.on) 
  const appointmentDay = DateManupulation.dayOnDate(appointmentDate)

  // services offered by single employees 
  if(employeeId){
  const availability = await jobs.findOne({
    where: {
      status: 'assign',
      employeeId: req.body.employeeId,
      on:appointment.on,
      bookingId:{[Op.not]:bookingId},
      [Op.or]: [
        {
          // Case starts within the busy time range
          startTime: {
            [Op.between]: [appointment.startTime, appointment.endTime],
          },
        },
        {
          //  when ends within the busy time range
          endTime: {
            [Op.between]: [appointment.startTime, appointment.endTime],
          },
        },
        {
          //when within the job time range
          [Op.and]: [
            { startTime: { [Op.lte]: appointment.startTime } },
            { endTime: { [Op.gte]: appointment.endTime } },
          ],
        },
      ],
    },
    attributes: ['startTime', 'endTime'],
  });

  if(availability){ return res.status(200).json(response({ status :'2',message:"Time slot booked by another customer"}))}
  }
 const jobIds = services.map(obj => obj.id)
  const assignTimeSlots = Custom.scheduleSessions(appointment,services);

  let sessions = await jobs.findAll({ where: { id: jobIds } });

  // Update each job's times
  assignTimeSlots.forEach(newJobData => {
    // Find the corresponding job in sessions array by ID
    const jobToUpdate = sessions.find(job => job.id === newJobData.id);
    if (jobToUpdate) {
        // Update startTime, endTime, and on attributes
        jobToUpdate.startTime = newJobData.startTime;
        jobToUpdate.endTime = newJobData.endTime;
        jobToUpdate.on = newJobData.on;
    } else {
        console.log(`Job with ID ${newJobData.id} not found in sessions array.`);
    }
});
  // Save all changes to the database
  await Promise.all(sessions.map(job => job.save()));
  await booking.update({startTime:appointment.startTime,endTime:appointment.endTime,on:appointment.on},{where:{id:bookingId}})
  const output =  response({message:'Appointment re-schedule successfully.',data:{}}); 
  return res.status(200).json(output);
}

//* 5.Reschedule Multiple Employee Appointment -----------------

exports.rescheduleMultipleEmployeeAppointment = async (req, res, next) => {
  const {bookingId} = req.params;
  const {appointment,services} = req.body;
  appointment.startTime = DateManupulation.convertTo24HourFormat(appointment.startTime)
 
 
  appointment.endTime = DateManupulation.convertTo24HourFormat(appointment.endTime)
  const appointmentDate = new Date(appointment.on) 
  const appointmentDay = DateManupulation.dayOnDate(appointmentDate)


  let employeeData, JobsInput;
  // services offered by multiple employees
  if (!req.body.employeeId) {
    employeeData = await employee.findAll({
     where: {
       salonDetailId: appointment.salonDetailId,
     },
     attributes:['id'],
     include: [
       {
         model: employeeService,
         required:true,
         attributes: ['status'],
         include: {
           model: service,
           required:true,
           attributes: ['id']
         }
       },
       {
         model: time,
         required:true,
         where: { day : appointmentDay },
         attributes: ['openingTime', 'closingTime']
       },
       {
         model:jobs,
         where:{on:appointment.on ,status:'assign'},
         required:false,
         attributes:['duration','startTime','endTime'],
       }
     ]
   });
   employeeData.sort((a, b) => a.jobs.length - b.jobs.length);
  }

  console.log("🚀~🚀 ~🚀 ~🚀 ~🚀 ~🚀 ~🚀 ~🚀 ~🚀  services:", services)
  const assignTimeSlots = Custom.scheduleSessions(appointment,services)
  console.log("🚀 ~ assignTimeSlots:", assignTimeSlots)
  
   JobsInput = Custom.assignEmployeesToServices(employeeData,assignTimeSlots);
   appointment.status = 'book';
  const findUnAssign = JobsInput.find(el => el.status === 'pending')
  if (findUnAssign) {
    appointment.status = 'pending';
  }
  const jobIds = services.map(obj => obj.id)
  console.log("🚀 ~ exports.rescheduleMultipleEmployeeAppointment= ~ jobIds:", jobIds)
  let sessions = await jobs.findAll({ where: { id: jobIds } });

  // Update each job's times
  JobsInput.forEach(newJobData => {
    // Find the corresponding job in sessions array by ID
  // console.log("🚀 ~ exports.rescheduleMultipleEmployeeAppointment= ~ newJobData:", newJobData)

    const jobToUpdate = sessions.find(job => job.id === newJobData.id);
    // console.log("🚀 ~ exports.rescheduleMultipleEmployeeAppointment= ~ jobToUpdate:", jobToUpdate)
    if (jobToUpdate) {
        // Update startTime, endTime, and on attributes
        jobToUpdate.startTime = newJobData.startTime;
        jobToUpdate.endTime = newJobData.endTime;
        jobToUpdate.on = newJobData.on;
        jobToUpdate.employeeId = newJobData.employeeId;
        jobToUpdate.status = newJobData.status;
    } else {
        console.log(`Job with ID ${newJobData.id} not found in sessions array.`);
    }
});
  // Save all changes to the database
  await Promise.all(sessions.map(job => job.save()));
  await booking.update({startTime:appointment.startTime,endTime:appointment.endTime,on:appointment.on,status:appointment.status},{where:{id:bookingId}});
  const output =  response({message:'Appointment re-schedule successfully.'}); 
  return res.status(200).json(output);
}

//* 6.Cancel Appointment -----------------

exports.cancelAppointment = async (req, res, next) => {
  const {bookingId} = req.params;
 
  await booking.update({status:'cancel'},{where:{id:bookingId}})
  await jobs.update({status:'cancel'},{where:{bookingId}})
  //!TODO Term and Condition on cancel charges and time ---->>> after discuss 
  const output =  response({message:'Appointment cancel successfully.',data:{}}); 
  return res.status(200).json(output);
}

//* 7.Book Appointment -----------------
exports.bookAppointment = async (req, res, next) => {
  const customerId = req.user.id;
  const {appointment, services} = req.body;
 
  appointment.customerId = customerId;
 
  if(req.body.paymentMethod==='card'){
  if(!req.body.stripeCardId) throw new AppError('Card not attached! Please attach card to proceed',200)
  appointment.stripeCardId = req.body.stripeCardId
 }else if(req.body.paymentMethod==='cash'){
  appointment.paymentMethod = 'cash'
 }else{
  throw new AppError('Please select payment a method first',200)
 }
  appointment.startTime = DateManupulation.convertTo24HourFormat(appointment.startTime)
  console.log("🚀 ~ AFTER START-TIME", appointment.startTime)
 
  appointment.endTime = DateManupulation.convertTo24HourFormat(appointment.endTime)
  const appointmentDate = new Date(appointment.on) 
  const appointmentDay = DateManupulation.dayOnDate(appointmentDate)

// services offered by single employees 
  if(req.body.employeeId){
  const availability = await jobs.findOne({
    where: {
      status: 'assign',//TODO add  Date check 
      on:appointment.on,
      employeeId: req.body.employeeId,
      [Op.or]: [
        {
          // Case starts within the busy time range
          startTime: {
            [Op.between]: [appointment.startTime, appointment.endTime],
          },
        },
        {
          //  when ends within the busy time range
          endTime: {
            [Op.between]: [appointment.startTime, appointment.endTime],
          },
        },
        {
          //when within the job time range
          [Op.and]: [
            { startTime: { [Op.lte]: appointment.startTime } },
            { endTime: { [Op.gte]: appointment.endTime } },
          ],
        },
      ],
    },
    attributes: ['startTime', 'endTime'],
  });

  if(availability){ return res.status(200).json(response({ status :'2',message:"Time slot booked by another customer"}))}
  }

let employeeData, JobsInput;
  // services offered by multiple employees
  if (!req.body.employeeId) {
    employeeData = await employee.findAll({
     where: {
       salonDetailId: appointment.salonDetailId,
     },
     attributes:['id'],
     include: [
       {
         model: employeeService,
         attributes: ['status'],
         include: {
           model: service,
           attributes: ['id']
         }
       },
       {
         model: time,
         required:true,
         where: { day : appointmentDay },
         attributes: ['openingTime', 'closingTime']
       },
       {
         model:jobs,
         where:{on:appointment.on ,status:'assign'},
         required:false,
         attributes:['duration','startTime','endTime'],
       }
     ]
   });
   employeeData.sort((a, b) => a.jobs.length - b.jobs.length);
  }

  console.log("🚀~🚀 ~🚀 ~🚀 ~🚀 ~🚀 ~🚀 ~🚀 ~🚀  services:", services)
  const assignTimeSlots = Custom.scheduleSessions(appointment,services)
  console.log("🚀 ~ assignTimeSlots:", assignTimeSlots)
  if (!req.body.employeeId) {
   JobsInput = Custom.assignEmployeesToServices(employeeData,assignTimeSlots);
  }else{
   JobsInput = assignTimeSlots.map(service => ({ ...service, employeeId:req.body.employeeId,status : 'assign' }));
  }
  const findUnAssign = JobsInput.find(el => el.status === 'pending')
  if (findUnAssign) {
    console.log("🚀 ~ findUnAssign:", findUnAssign)
    appointment.status = 'pending';
  }
 const book = await booking.create(appointment)
  if(!book) throw new AppError('Something went wrong appointment not booked',200)
  
  //TODO  intial payment will be charge be Here 

  const finalInput = JobsInput.map(service => ({ ...service, bookingId:book.id }));
  const jobsData =  await jobs.bulkCreate(finalInput)
  if(!jobsData || jobsData.length < 1 ) {
    await booking.destroy({where: {id:book.id}});
    throw new AppError('Something went wrong appointment not booked.',200)
  }
  //TODO OR intial payment will be charge be Here 
  const upFront = await paymentPolicy.findOne({where:{salonDetailId:appointment.salonDetailId}});

  //Partial payment upfront  
  if(upFront && upFront.percentage > 0 ){
    const advanceAmount =  parseFloat((appointment.total*upFront.percentage)/100);
    const ephemeralKey=  await Stripe.createEphemeralKey(req.body.stripeCustomerId);
    const indent=  await Stripe.createPaymentIntendForUpFrontPayments(advanceAmount,req.body.stripeCustomerId);
    booking.update({upFrontPaymentPercentage:upFront.percentage,initialPayment:advanceAmount},{where:{id:book.id}})
  const data = {
    appointment:book.id,
    ephemeralKeySecret:ephemeralKey.secret,
    client_secret:indent.client_secret,
    paymentIntendId:indent.id,
    amount: appointment.total,
    upFrontPaymentPercentage:upFront.percentage,
    advanceAmount,
    stripeCustomerId:req.body.stripeCustomerId
    }
    const output =  response({status :'3',message:'Advance Payment.',data}); 
    return res.status(200).json(output);
  } 
  //Else No payment Upfront Send Email

  const emailInput = await booking.findOne({
    where:{id: book.id},
    attributes:['id','status'],
   include:[
     { 
       model : salonDetail ,
       attributes:['salonName'],
       include:{model:addressDBS,attributes:['streetAddress','city','district','province','country']}
     },
     { 
       model : user , 
       attributes:['firstName','lastName','email','countryCode','phoneNum'],
     },
     {
       model:jobs,
       attributes:['id','on','startTime','duration'],
       include:[
     
         { model : service ,attributes:['serviceName']},
         {
           model : employee, attributes:['position'],
           include:{model:user, attributes : ['firstName','lastName']}
         },
       ],
     }
   ]
  });

  EmailAppointmentConfirmToSalon(['sigidevelopers@gmail.com'],emailInput)

  const output =  response({ message:'Appoint booked successfully',data:{appointment:book.id}}); 
  return res.status(200).json(output);

};

//* 4.5 Capture Payment info

exports.captureUpFrontPaymentInfo= async (req, res, next) => {

  const userId = req.user.id;
  const {appointment,paymentInfo} = req.body;
  booking.update(paymentInfo,{where:{id:appointment,customerId:userId}})
  return res.status(200).json(response({data:{  appointment } }));

};

//* 5.fetch Appointments -----------------

exports.fecthAppointments = async (req, res, next) => {
 
  // TODO Filters
  const userId = req.user.id;
  const appointments = await booking.findAll({
    where: {
      customerId: userId,
      // status: { [Op.or]: ['pending', 'book'] }
    },
    attributes: [
      'id',
      'status',
      'startTime',
      'on',
      'total',
      [
        literal('(SELECT COUNT(*) FROM jobs WHERE jobs.bookingId = booking.id)'),
        'serviceCount'
      ]
    ],
    include: [
      {
        model: salonDetail,
        attributes: ['salonName', 'coverImage'],
        include: { model: addressDBS, attributes: ['streetAddress', 'city'] }
      },
      {
        model: jobs,
        attributes: []
      }
    ]
  });

  return res.status(200).json(response({data:{  appointments: appointments,currencyUnit:CURRENCY_UNIT} }));
};

//* 6.fetch Appointment Details

exports.fecthAppointmentsDetails = async (req, res, next) => {
  const id = req.params.id;
  const data = await booking.findOne({
    where:{id},
    attributes:['id',`status`, `total`, `initialPayment`,'actualCapturedAmount', `startTime`, `endTime`, `duration`,`on`,'rating','upFrontPaymentPercentage','initialPaymentIntend'],
    include:[
      {
        model:salonDetail, attributes:[ 'id',`salonName`, `coverImage`,'connectAccountId'],
        include:[
          {model:addressDBS,attributes:[`id`, `streetAddress`, `building`, `floor`, `apartment`, `district`, `city`, `country`, `lat`, `lng`]},
          {model:user, attributes:[ `countryCode`, `phoneNum`,'stripeCustomerId']},
          {model:cancellationPolicy, attributes:{ exclude: ['createdAt','updatedAt','salonDetailId'] }},
          {model:reschedulePolicy, attributes:{ exclude: ['createdAt','updatedAt','salonDetailId'] }},
       ]
      },
      {
      model:jobs,
      attributes:[`id`,`status`, `total`,`duration`,'employeeId','tip','extra'],
      include:[
        {
        model:employee,attributes:['id'],
        include:{model:user,attributes:[`firstName`, `lastName`]}
        },
        {model:service,attributes:[`id`, `serviceName`]},
      ]
    }]
  });

  const actualJobs = data.jobs.map(el => {
    const obj  = el.toJSON()
     
    if (obj.employee) {
      obj.employee = `${obj.employee.user.firstName} ${obj.employee.user.lastName}`;
      obj.employeeId = `${obj.employeeId}`;
    }else{
      obj.employee = "";
      obj.employeeId = ``;
    }
    return obj;
  })

  const output = data.toJSON()
  output.jobs = actualJobs

  return res.status(200).json(response({data:{  appointments: output, currencyUnit:CURRENCY_UNIT} }));
};

//~ AppointMent Journey ends  

//!STRIPE
//~ Stripe section

//* 1.Stripe Add Card -----------------

exports.addCard = async (req, res, next) => {
  const { cardName, cardExpYear, cardExpMonth, cardNumber, cardCVC } =req.body;
  const customerID = req.user.id;
  const customer = await user.findByPk(customerID,{ attributes:['firstName','lastName','email','stripeCustomerId']});
  let customerId = null;
  if (!customer) throw new AppError('User not found!', 200);
  if (!customer.stripeCustomerId) {
    const fullName = `${customer.firstName} ${customer.lastName}`
      const stripeCustomerId=  await Stripe.addCustomer(fullName,customer.email);
      await user.update({stripeCustomerId},{where:{ id:customerID}});
      customerId =stripeCustomerId;
  }else{
      customerId =customer.stripeCustomerId;
  }
  req.body.customerId = customerId;
  if (customerId === null) throw new AppError('Something Went Wrong', 200);

  // const cardData = await Stripe.addCard( 
  //   customerId,
  //   cardName,
  //   cardExpYear,
  //   cardExpMonth,
  //   cardNumber,
  //   cardCVC);

    const cardData = await Stripe.addCard(req.body);
  const output =  response({message:'Card Added successfully',data:{stripePaymentId:cardData}}); 
  return res.status(200).json(output);

}

/*
* 2.Get Cards   ___________________________________
*/

exports.fetchCards = async (req, res, next) => {
  const userId = req.user.id;
  console.log("🚀 ~ ~ userId:", userId)
  const customer = await user.findByPk(userId,{ attributes:['firstName','lastName','email','stripeCustomerId']});
  if (customer.stripeCustomerId === null || customer.stripeCustomerId === ""){
    const output =  response({message:'All cards',data:{cards:[]}}); 
    return res.status(200).json(output);
  } 
  const customerId = customer.stripeCustomerId;
  const allCards = await Stripe.cards(customerId);
  console.log("🚀 ~ ~ customerId:", customerId)
 
  const stripeCards = allCards.data.map(obj => ({
    id: obj.id,
    name: obj.billing_details.name,
    brand: obj.card.brand,
    expMonth: obj.card.exp_month,
    expYear: obj.card.exp_year,
    last4: obj.card.last4,
    funding: obj.card.funding
  }));
  console.log("🚀 ~ stripeCards ~ stripeCards:", stripeCards)

  const output =  response({data:{cards:stripeCards}}); 
  return res.status(200).json(output);
}

/*
 *3.delete Card __________________________________
*/

exports.detachCard = async (req, res, next) => {
  const pmId = req.params.pm;
  const detach =  await Stripe.cardDetach(pmId)
  const output =  response({message:'Card detach success',data:detach}); 
  return res.status(200).json(output);
}

//!Promo Code

//* 1.Apply Coupon -----------------

exports.applyCoupon = async (req, res, next) => {
  const currentDay = CustomDate.currentDay();
  await coupon.update(
    { status: 'expire' },
    {
      where: {
        [Op.and]: [
          { till: { [Op.lt]: currentDay.currentDateOnly } },
          { status:'active' }
        ]
      }
    }
  );
  const {salonId, promoCode } = req.body;
  const data = await coupon.findOne({where:{promoCode,salonDetailId:salonId},attributes:[`id`, `promoCode`, `type`, `status`, `value`]})
  if (!data) throw new AppError('Invalid promo code', 200);
  if (data.status === 'expire') throw new AppError('Promo code Exprie.', 200);
  const output =  response({message:'success',data:{promoCode:data}}); 
  return res.status(200).json(output);
}

//~ Reschedule & cancel

//!Drawer

//* 1.Update Profile Image -----------------

exports.profileImageUpdate = async (req, res, next) => {
 
  const userId = req.user.id;
  const data = await user.findByPk(userId, {
    attributes: ['id']
  });
  if (!data) throw new AppError('User Not found',200);

  if (!req.file) throw new AppError('Please provide image.',200);
  let tmpPath = req.file.path;
  let imagePath = tmpPath.replace(/\\/g, "/");
  await user.update({image: imagePath},{where:{id:userId}})

  const output =  response({message:'Profile Image updated.',data:{image:imagePath}}); 
  return res.status(200).json(output);
};

//* 2.Update profile data -----------------

exports.UpdateProfileData = async (req, res, next) => {
 
  const userId = req.user.id;
  const data = req.body;
  await user.update(data,{where:{id:userId}})

  const output =  response({message:'Profile data updated.',data}); 
  return res.status(200).json(output);
};

//!Favorites

//* 1.like Dislike  -----------------

exports.likeDislike = async (req, res, next) => {
 
  const userId = req.user.id;
  const salonDetailId = req.params.salon;
  let msg = "Like";

  const data = await favorite.findOne({
    where:{userId,salonDetailId},
    attributes: ['id']
  });

  if (data){ 
    await data.destroy();
    msg = "Dislike";
  }else{
     await favorite.create({userId,salonDetailId})
  }

  await user.update(data,{where:{id:userId}})

  const output =  response({message:`${msg}.`}); 
  return res.status(200).json(output);
};

//!Reviews and Ratings

//* 1.Fetch Reviews And Ratings  -----------------

exports.ratingAndReviews = async (req, res, next) => {

  const userId = req.user.id;
  const condition = {customerId:userId , status: 'complete',rating:'pending'};

  if (req.params.appointment) condition.rating={[Op.or]:['pending','skiped']}; 
  
  const appointment = await booking.findOne({
    where:condition,
    attributes:['id',`status`, `startTime`, 'endTime',`on`],
    include:[
      {
        model:salonDetail, attributes:['id', `salonName`, 'coverImage'],
        include:{model:addressDBS,attributes:[`streetAddress`,`city`]}},
      {
      model:jobs,
      attributes:['id'], 
        include:[
        {model:service,attributes:['id','serviceName']},
        {
          model:employee,attributes:['id','position'] ,
          include: {model:user,attributes:['firstName','lastName','image']},
        },
       ]
      }
    ]
  });

  if (!appointment) throw new AppError('Currently, there is nothing that requires review or feedback.',200)  
  
 const epmloyess = Object.values(appointment.jobs.reduce((acc, job) => {
    const employeeId = job.employee.id;
    const serviceName = job.service.serviceName.trim();
    const employee = job.employee.user;

    if (!acc[employeeId]) {
        acc[employeeId] = { id: employeeId, employee: employee, services: [] };
    }

    if (!acc[employeeId].services.includes(serviceName)) {
        acc[employeeId].services.push(serviceName);
    }
    return acc;
  }, {}));

  const result ={
    appointmentId:appointment.id,
    on:appointment.on,
    startTime:appointment.startTime,
    endTime:appointment.endTime,
    salonDetail:appointment.salonDetail,
    epmloyess,
  }

  const output =  response({message:`success`,data:result}); 
  return res.status(200).json(output);
};

//* 2.Rate Employees  -----------------

exports.rateEmployes = async (req, res, next) => {

  const userId = req.user.id;
  const {salonDetailId ,appointmentId,at, employeesRating} = req.body;

  employeesRating.forEach(el => {
    el.salonDetailId = salonDetailId;
    el.at = at;
    el.userId = userId;
    el.bookingId =appointmentId
  })

  await rating.bulkCreate(employeesRating)
  
  await booking.update({rating :'done'},{where:{id:appointmentId}})
  
  const output =  response({message:`Thank you for your feedback! We appreciate it.`,data:{}}); 
  return res.status(200).json(output);
};

//* 2.Rate Employees  -----------------

exports.skipRating = async (req, res, next) => {

  const {doNotShow,appointmentId} = req.body;
  const status = doNotShow?'cancel':'skiped';
  await booking.update({rating :status},{where:{id:appointmentId}})

  const output =  response({message:`success`,data:{}}); 
  return res.status(200).json(output);

};

//!Stripe Customers Ephemeral Key Secret

//* 2.Rate Employees  -----------------

exports.renewEphemeralSecret = async (req, res, next) => {
const userId = req.user.id;

const userExist = await user.findByPk(userId, {
  attributes: ['id', 'firstName', 'lastName', 'email', 'status','image','stripeCustomerId']
});

 
  if (!userExist) throw new AppError('resource not Found',200);  
  
    const fullName = `${userExist.firstName} ${userExist.lastName}`
    
    const stripeCustomerId= userExist.stripeCustomerId || await Stripe.addCustomer(fullName,userExist.email);
    const ephemeralKeySecret=  await Stripe.createEphemeralKey(stripeCustomerId);
    console.log("🚀 ~ exports.signup= ~ ephemeralKeySecret:", ephemeralKeySecret);
    const expiry = DateManupulation.stampToDate(ephemeralKeySecret.expires);
    console.log("🚀 ~ exports.signup= ~ expiry:", expiry)
   
    const input = {stripeCustomerId,ephemeralKeySecret:ephemeralKeySecret.id ,ephemeralKeyExpireAt:expiry };
    
    if (!userExist.stripeCustomerId) input.stripeCustomerId = stripeCustomerId;

    await user.update(input,{where:{ id:userExist.id}});
     
    userExist.stripeCustomerId =stripeCustomerId;
    userExist.ephemeralKeySecret =ephemeralKeySecret.id;
    userExist.ephemeralKeyExpireAt =expiry;
 
  const output =  response({message:`success`,data:userExist}); 
  return res.status(200).json(output);

};

//!Salon Policies

//* 1.Policies  -----------------

exports.salonPolicies = async (req, res, next) => {

  const salonDetailId = req.params.salon;   
  console.log("🚀 ~ exports.salonPolicies= ~ salonDetailId:", salonDetailId)
  
  const output = await  salonDetail.findOne({
    where:{id:salonDetailId},
    attributes:['id','salonName'],
    include:[
      {model:cancellationPolicy, attributes:{ exclude: ['createdAt','updatedAt','salonDetailId'] }},
      {model:depositPolicy, attributes:{ exclude: ['createdAt','updatedAt','salonDetailId'] }},
      {model:noShowPolicy, attributes:{ exclude: ['createdAt','updatedAt','salonDetailId'] }},
      {model:reschedulePolicy, attributes:{ exclude: ['createdAt','updatedAt','salonDetailId'] }},
      {model:paymentPolicy, attributes:{ exclude: ['createdAt','updatedAt','salonDetailId'] }},
    ]
  })
  
    return res.status(200).json(output);
  
};

//!Salon Subcription

//* 1.Subcription From Client-Side  -----------------

exports.forSubcription = async (req, res, next) => {
  
  const salon =  await user.findOne({where:{id:req.user.id},
    attributes: ['stripeCustomerId']
  });
  console.log("ðŸš€ ~ exports.forSubcription= ~ salonsalonsalona:", salon.id)

  if (!salon) throw new AppError('resource not found',200) 
  

  const ephemeralKey=  await Stripe.createEphemeralKey(salon.stripeCustomerId);
  const indent=  await Stripe.createSubscriptionWithPriceId(salon.stripeCustomerId,req.body.priceId,);
//   return res.json(indent);
  const data = {
    ephemeralKeySecret:ephemeralKey.secret,
    client_secret:indent.latest_invoice.payment_intent.client_secret,
    subscriptionId:indent.id,
    stripeCustomerId:salon.stripeCustomerId
  }
    const output =  response({status :'1',message:'Payment.',data}); 

    return res.status(200).json(output);
  
};
  
//* 2. Check Subcription Feedback  -----------------

exports.checkSubscription = async (req, res, next) => {
  
  const subscription=  await Stripe.subscriptionsRetrieve(req.body.subscriptionId);
 
    const data = {
      subscription
    };

    const output =  response({status :'1',message:'subscription.',data}); 

    return res.status(200).json(output);
  
};

//!Client Feedback 

//* 1. Client Feedback  -----------------

exports.clientFeedBack = async (req, res, next) => {
  let limit = 100
  const condition = {};
  if(req.query.limit) limit = req.query.limit * 1; 
  if(req.params.salon) condition.salonDetailId = req.params.salon; 
  if(req.params.employee) condition.employeeId = req.params.employee; 
  if(req.params.client) condition.userId = req.params.client; 
  if(req.params.booking) condition.bookingId = req.params.booking; 

  const feedbacks = await rating.findAll({
      where:condition,
      limit: limit,
      attributes: ['id', 'value', 'comment', 'createdAt'],
      include: {
        model: user,
        attributes: ['firstName', 'lastName', 'image']
      },
      order: [
        ['createdAt', 'DESC']  
    ]
  });
   
  return res.json(response( {message:"Client Feedbacks.", data :{limit, feedbacks }}));
};

