module.exports = (sequelize, DataTypes) => {
    const paymentPolicy = sequelize.define('paymentPolicy', {
      percentage: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
    });

    paymentPolicy.associate = models => {
        models.salonDetail.hasMany(paymentPolicy);
        paymentPolicy.belongsTo(models.salonDetail);
      };
    return paymentPolicy;
  };