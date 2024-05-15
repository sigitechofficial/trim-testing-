module.exports = (sequelize, DataTypes) => {
    const depositPolicy = sequelize.define('depositPolicy', {
      refundPercentage: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 10,
      }
    });

    depositPolicy.associate = models => {
        models.salonDetail.hasMany(depositPolicy);
        depositPolicy.belongsTo(models.salonDetail);
      };
    return depositPolicy;
  };