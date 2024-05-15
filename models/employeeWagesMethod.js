// wagesMethod.js
module.exports = (sequelize, DataTypes) => {
  const employeeWagesMethod = sequelize.define("employeeWagesMethod", {
    value: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    cycle: {
      type: DataTypes.ENUM('monthly', 'daily', 'weekly'), 
      allowNull: false,
      defaultValue:"weekly"
    },
    cycleValue: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue:1
    },
  });

  employeeWagesMethod.associate = (models) => {
    models.employee.hasOne(employeeWagesMethod);
    employeeWagesMethod.belongsTo(models.employee);

    models.wagesMethod.hasOne(employeeWagesMethod);
    employeeWagesMethod.belongsTo(models.wagesMethod);
  };

  return employeeWagesMethod;
};
