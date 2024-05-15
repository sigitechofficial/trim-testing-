// wagesMethod.js
module.exports = (sequelize, DataTypes) => {
    const wagesMethod = sequelize.define('wagesMethod', {
      methodName: {
        type: DataTypes.STRING(),
        allowNull: false,
      }
    });
  
    wagesMethod.associate = (models) => {
    };
  
    return wagesMethod;
  };
  