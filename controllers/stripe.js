const { STRIPE_PUBLISHABLE_KEY, STRIPE_SECRET_KEY } = process.env;
const stripe = require("stripe")(STRIPE_SECRET_KEY);
const AppError = require("../utils/appError");

// Amount to Cents
function convertToCents(amount) {
  return Math.round(amount * 100);
}

//! Customers
/*
 *  1:  Create Customer ________________________
 */
async function addCustomer(name, email) {
  try {
    const customer = await stripe.customers.create({ name, email });
    console.log("🚀 ~ addCustomer ~ customer:", customer)
    return customer.id;
  } catch (error) {
    console.error(error);
    throw new AppError(`${error.code}:${error.message} `, 400);
  }
}

//! Cards ____________________________________________________________________________
/*
 *  1:  Create Card ________________________
 */
async function addCard(data) {
  try {
    const {
      customerId,
      cardName,
      cardExpYear,
      cardExpMonth,
      cardNumber,
      cardCVC,
    } = data;
    const paymentMethod = await stripe.paymentMethods.create({
      type: "card",
      billing_details: { name: cardName },
      // customer: customerId, //We Can also Use This instead of Attach
      card: {
        number: cardNumber,
        exp_month: cardExpMonth,
        exp_year: cardExpYear,
        cvc: cardCVC,
      },
    });
    //   Attact payment Method to Customer (Alternate)
    const attachToCustomer = await stripe.paymentMethods.attach(
      paymentMethod.id,
      { customer: customerId }
    );

    return attachToCustomer.id;
  } catch (error) {
    throw new AppError(`${error.code}:${error.message}`, 400);
  }
}

/*
 *  1:  Create Payment method ________________________
 */
async function createPaymentMethod(paymentMethodToken) {
  try {
    const paymentMethod = await stripe.paymentMethods.create({
      type: "card",
      card: {
        token: paymentMethodToken,
      },
    });

    const paymentMethodId = paymentMethod.id;

    return paymentMethodId;
  } catch (error) {
    throw new AppError(`${error.code}:${error.message} `, 400);
  }
}
/*
 * 2 :  Get All Card ________________________
 */

async function cards(customerId) {
  try {
    const paymentMethods = await stripe.customers.listPaymentMethods(
      customerId,
      { type: "card" }
    );
    return paymentMethods;
  } catch (error) {
    throw new AppError(`${error.code}:${error.message} `, 400);
  }
}
/*
 * 3 :  Detach Card ________________________
 */

async function cardDetach(paymentMethodId) {
  try {
    const paymentMethod = await stripe.paymentMethods.detach(paymentMethodId);
    return paymentMethod;
  } catch (error) {
    throw new AppError(`${error.code}:${error.message} `, 400);
  }
}

//! PaymenIntend _______________________________________________________

/*
 *  1:  Create PaymenIntend for Upfront Payments
 */
async function createPaymentIntendForUpFrontPayments(amount, customerId) {
  try {
        const paymentIntent = await stripe.paymentIntents.create({
      amount: convertToCents(amount),
      currency: "gbp", //Specify British pounds (GBP)  as the currency
      //setup_future_usage: 'off_session',
      customer: customerId,
      // capture_method: "manual",
      automatic_payment_methods: {
        enabled: true,
      }
    });
  
    return paymentIntent;
  } catch (error) {
    throw new AppError(`${error.code}:${error.message} `, 400);
  }
}


/*
 *  1:  Create PaymenIntend
 */
async function createPaymentIntend(amount, customerId, paymentMethodId) {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: convertToCents(amount),
      currency: "usd",
      payment_method: paymentMethodId,
      customer: customerId,
      capture_method: "manual",
    });
    //Confirm
    const confirmIntent = await stripe.paymentIntents.confirm(
      paymentIntent.id,
      { payment_method: paymentMethodId }
    );
    return confirmIntent.id;
  } catch (error) {
    throw new AppError(`${error.code}:${error.message} `, 400);
  }
}

/*
 *  2:  GET PaymenIntend
 */
async function paymenIntend(paymentIntentId) {
  try {
    const paymentIntent = await stripe.paymentMethods.retrieve(paymentIntentId);
    return paymentIntent;
  } catch (error) {
    throw new AppError(`${error.code}:${error.message} `, 400);
  }
}

/*
 *  3:  Confirm PaymenIntend
 */
async function confirmIntend(paymentIntentId, paymentMethodId) {
  try {
    const confirmIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: paymentMethodId,
    });
    return confirmIntent;
  } catch (error) {
    throw new AppError(`${error.code}:${error.message} `, 400);
  }
}

/*
 *  4:  On counter offer I payment incremented Payment intent
 */
async function finalizePayment(total, paymentIntentId) {
  try {
    let amount = total * 100; // convert to cents
    amount = parseInt(amount);
    const paymentIntent = await stripe.paymentIntents.retrieve(
      `${paymentIntentId}`
    );
    if (!paymentIntent)
      throw new AppError("Intent Not Found", "Payment Not Confirmed Yet");
    //^ Case 1 ( Counter offer amount is Greater then the Actual Amount)
    if (amount > paymentIntent.amount) {
      let newAmount = amount - paymentIntent.amount;
      //Create a new intent
      const newPaymentIntent = await stripe.paymentIntents.create({
        amount: newAmount,
        currency: paymentIntent.currency,
        payment_method: paymentIntent.payment_method,
        customer: paymentIntent.customer,
        capture_method: "manual",
      });
      //confirm new payment intent
      const confirmNewIntent = await stripe.paymentIntents.confirm(
        newPaymentIntent.id,
        {
          payment_method: paymentIntent.payment_method,
        }
      );
      // Check if not confirmed
      if (confirmNewIntent.status === "requires_capture") {
        const capturePreIntent = await stripe.paymentIntents.capture(
          paymentIntent.id
        );
        const captureNewIntent = await stripe.paymentIntents.capture(
          confirmNewIntent.id
        );
        return {
          actual: capturePreIntent.id,
          increment: captureNewIntent.id,
          capturedAmount:
            (captureNewIntent.amount_received +
              capturePreIntent.amount_received) /
            100,
        };
      } else {
        throw new AppError(
          "Extra Payment Not Confirmed",
          "Counter Offer Not Accpeted"
        );
      }
    }
    //^ Case (  Counter offer amount is equal to Actual Amount)
    else if (amount === paymentIntent.amount) {
      const captureIntent = await stripe.paymentIntents.capture(
        paymentIntent.id
      );
      return {
        captureIntent: captureIntent.id,
        capturedAmount: captureIntent.amount_received / 100,
      };
    }
    //^ Case (  Counter offer amount is equal to Actual Amount)
    else if (amount < paymentIntent.amount) {
      const captureIntent = await stripe.paymentIntents.capture(
        paymentIntent.id,
        { amount_to_capture: amount }
      );
      const remainingToRefund =
        captureIntent.amount * 1 - captureIntent.amount_received * 1;
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntent.id,
        amount: remainingToRefund,
      });

      return {
        captureIntent: captureIntent.id,
        capturedAmount: captureIntent.amount_received / 100,
        refund: refund.amount / 100,
      };
    }
  } catch (error) {
    throw new AppError(`${error.code}:${error.message} `, 400);
  }
}

async function AllProducts(limit) {
  const products = await stripe.products.list({
    limit,
  });
  let listOfPlans = [];
  const productsWithPrices = await Promise.all(
    products.data.map(async (product) => {
      const prices = await stripe.prices.list({ product: product.id });
      const price = prices.data[0]; // Assume the first price is associated with the product

      const features = product.features || [];
      return {
        id: product.id,
        name: product.name,
        description: product.description,
        price: price.unit_amount / 100,
        PriceId: price.id,
        duration: price.recurring.interval,
        features,
      };
    })
  );
  return productsWithPrices;
}

async function createSubscription(
  customerId,
  priceId,
  trialDays,
  paymentMethodId
) {
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    trial_period_days: trialDays,
    payment_method: paymentMethodId,
  });
  return subscription;
}

async function getSubscription(subscriptionPlan) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionPlan);
  const product = await stripe.products.retrieve(subscription.plan.product);
  const prices = await stripe.prices.list({ product: product.id });
  const price = prices.data[0]; // Assume the first price is associated with the product
  const features = product.features || [];

  const paymentMethods = await stripe.customers.listPaymentMethods(
    subscription.customer,
    {
      limit: 3,
    }
  );
  // return subscription
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: price.unit_amount / 100,
    PriceId: price.id,
    duration: price.recurring.interval,
    features,
    Card: paymentMethods.data[0].card.last4,
    expire: subscription.current_period_end,
  };
}

async function cancelSubscription(subscriptionPlan) {
  const subscription = await stripe.subscriptions.cancel(`${subscriptionPlan}`);
  return subscription;
}

async function updateSubscription(
  subscriptionId,
  newPriceId,
  customerId,
  paymentMethodId
) {
  if (paymentMethodId) {
    // Set the new payment method as the default for future invoices
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
  }

  // Retrieve the subscription
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Update subscription items with the new product
  const updatedItems = subscription.items.data.map((item) => ({
    id: item.id,
    price: newPriceId,
  }));

  // Save changes by updating the subscription
  const updatedSubscription = await stripe.subscriptions.update(
    subscriptionId,
    {
      items: updatedItems,
    }
  );

  return updatedSubscription;
}

async function subscriptionInvoices(subscriptionPlan) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionPlan);

  // Retrieve product details
  const product = await stripe.products.retrieve(subscription.plan.product);

  // Retrieve price details
  const prices = await stripe.prices.list({ product: product.id });
  const price = prices.data[0]; // Assume the first price is associated with the product

  // Retrieve payment methods associated with the customer
  const paymentMethods = await stripe.paymentMethods.list({
    customer: subscription.customer,
    type: "card",
    limit: 3,
  });

  // Retrieve invoice details
  const invoices = await stripe.invoices.list({
    subscription: subscriptionPlan,
    limit: 1, // Limit to retrieve only the latest invoice
  });

  // Extract invoice data
  const invoiceData = invoices.data.map((invoice) => ({
    startDate: new Date(invoice.period_start * 1000).toLocaleDateString(),
    endDate: new Date(invoice.period_end * 1000).toLocaleDateString(),
    deductedAmount: invoice.amount_paid / 100, // Amount is in cents, so divide by 100 to get dollars
    productName: product.name,
    price: price.unit_amount / 100,
    duration: price.recurring.interval,
    cardLastFourDigits: paymentMethods.data[0].card.last4,
  }));

  // Return the formatted subscription data
  return invoiceData;
}

//update Subscription
async function updateProduct(productId, name, description, features) {
  const updatedProduct = await stripe.products.update(productId, {
    name,
    description,
    features,
  });
  return updatedProduct;
}

async function createConnectAccount(email, country) {
  const account = await stripe.accounts.create({
    type: "express", // You can use 'express', 'standard', or 'custom' depending on your needs
    country: country, // The country code for the account
    email, // The email address of the account holder
  });

  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: "https://example.com/reauth",
    return_url:
      "https://backend.trimworldwide.com/StripeAccountSuccessfulScreen",
    type: "account_onboarding",
  });
  return { accountLink, accountId: account.id };
}

async function createCheckoutSession(line_items, accountId, applicationFee) {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: line_items,
    mode: "payment",
    success_url: "https://example.com/success",
    cancel_url: "https://example.com/cancel",
    payment_intent_data: {
      application_fee_amount: applicationFee, // Fee amount in cents
      transfer_data: {
        destination: accountId, // Replace with the Connect account ID
      },
    },
  });
  // return session;
  return {
    url: session.url,
    total: session.amount_total,
    status: session.payment_status,
  };
}

async function retrievePaymentMethod(paymentMethodId) {
  const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
  return paymentMethod.card;
}

/*
 *  1:  Create PaymenIntend
 */
async function capturePayment(amount, customerId, paymentMethodId, accountId) {
  try {
    // Create a Payment Intent with the provided parameters
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // Convert amount to cents
      currency: "usd",
      payment_method: paymentMethodId,
      customer: customerId,
      capture_method: "manual", // Payment needs to be captured manually
      confirm: true, // Confirm the Payment Intent immediately
      return_url: "https://example.com/reauth",
      transfer_data: {
        destination: accountId, // Replace with the Connect account ID
      },
    });

    const paymentIntents = await stripe.paymentIntents.capture(
      paymentIntent.id
    );
    return paymentIntents;
  } catch (error) {
    // Handle any errors that occur during the process
    throw new AppError(`${error.code}:${error.message} `, 400);
  }
}

async function createStripeAccountLink(accountId) {
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: "https://example.com/reauth",
    return_url:
      "https://backend.trimworldwide.com/StripeAccountSuccessfulScreen",
    type: "account_onboarding",
  });
  return accountLink.url;
};

// create Ephemeral Key to open Stripe sheet on mobile app
async function createEphemeralKey(customerId, stripe_version) {
      const key = await stripe.ephemeralKeys.create(
          {customer: customerId},
          {apiVersion: "2020-08-27"//stripe_version
        }
      );
      return key;
}

async function subscriptionsRetrieve(subscriptionId) {
  try {
    const subscription = await stripe.subscriptions.retrieve(
      subscriptionId
    );
    console.log("Subscription created. Status is:", subscription);
    return subscription;
 
  }catch (error) {
    console.error(error);
    throw new AppError(`${error.code}:${error.message} `, 400);
  }
}

async function createSubscriptionWithPriceId(customerId, priceId) {
  try {
    //  Attach a payment method to the customer using clientSecret (assuming client has already set this up)
    // Note: This step might actually involve the mobile client confirming the PaymentIntent or SetupIntent.
    // Here, we're assuming that the client has completed necessary front-end steps to authorize usage of the payment method.
    // Create a subscription using the provided priceId
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      expand: ['latest_invoice.payment_intent'],
      payment_behavior: 'default_incomplete', 
    });
    console.log("ðŸš€ ~ createSubscriptionWithPriceId ~ subscription.latest_invoice.payment_intent:", subscription.latest_invoice)
    return subscription;
  }catch (error) {
    console.error(error);
    throw new AppError(`${error.code}:${error.message} `, 400);
  }
}
 

module.exports = {
  // customer
  addCustomer,
  // payment Mehtods
  addCard,
  createPaymentMethod,
  cards,
  cardDetach,
  // payment Intents
  createPaymentIntend,
  createPaymentIntendForUpFrontPayments,
  paymenIntend,
  confirmIntend,
  finalizePayment,
  //Products & Subscription Plans
  AllProducts,
  createSubscription,
  getSubscription,
  cancelSubscription,
  updateSubscription,
  subscriptionInvoices,
  updateProduct,
  createConnectAccount,
  createCheckoutSession,
  retrievePaymentMethod,
  capturePayment,
  createStripeAccountLink,
  createEphemeralKey,
  createSubscriptionWithPriceId,
  subscriptionsRetrieve,
};
