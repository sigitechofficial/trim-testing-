// service.js
module.exports = (sequelize, DataTypes) => {
  const service = sequelize.define('service', {
    serviceName: {
      type: DataTypes.STRING(),
      allowNull: false
    },
    price: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: true // You may adjust this based on your requirements
    },
    discount: {
      type: DataTypes.INTEGER,
      defaultValue:0
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  });

  service.associate = models => {
    models.salonDetail.hasMany(service);
    service.belongsTo(models.salonDetail);
  };

  return service;
};
