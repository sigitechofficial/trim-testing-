// salonDetail.js
module.exports = (sequelize, DataTypes) => {
  const salonDetail = sequelize.define('salonDetail', {
    approvedByAdmin: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false
    },
    status: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: true
    },
    registrationDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    registrationExpiryDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    salonName: {
      type: DataTypes.STRING(),
      allowNull: true,
      defaultValue: ''
    },
    description: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
    },
    coverImage: {
      type: DataTypes.STRING(),
      allowNull: true,
      // validate: {
      //   notNull: {
      //     msg: 'Cover image is Required'
      //   },
      //   notEmpty: {
      //     msg: 'Cover image cannot be empty'
      //   }
      // }
    },
    teamSize: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    subscriptionPlan:{
      type: DataTypes.STRING(),
      allowNull: true,
    },
    connectAccountId:{
      type: DataTypes.STRING(),
      allowNull: true,
    }
  });

  salonDetail.associate = models => {
    models.user.hasMany(salonDetail);
    salonDetail.belongsTo(models.user);

    salonDetail.hasMany(models.employee);
    models.employee.belongsTo(salonDetail);

    models.addressDBS.hasMany(salonDetail);
    salonDetail.belongsTo(models.addressDBS);

    salonDetail.hasMany(models.rating);
    models.rating.belongsTo(salonDetail);

    salonDetail.hasMany(models.socialLink);
    models.socialLink.belongsTo(salonDetail);

    salonDetail.hasMany(models.time);
    models.time.belongsTo(salonDetail);

    salonDetail.hasMany(models.favorite);
    models.favorite.belongsTo(salonDetail);

    salonDetail.hasMany(models.employeeService);
    models.employeeService.belongsTo(salonDetail);

    salonDetail.hasMany(models.employeeAccessDefault);
    models.employeeAccessDefault.belongsTo(salonDetail);
  };

  return salonDetail;
};
