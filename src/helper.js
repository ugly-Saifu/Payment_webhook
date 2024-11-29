import Razorpay from "razorpay";
import crypto from "crypto";

const orderAmount = 1000000;
const taxPercentage = 18;

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const getOrderDetails = (context, discountPercentage = 0) => {
  const discountAmount = Math.floor(orderAmount * (discountPercentage / 100));
  const totalPayableAmount = orderAmount - discountAmount;
  const taxAmount = Math.floor(totalPayableAmount * (taxPercentage / 100));
  const retailAmount = totalPayableAmount - taxAmount;

  return {
    name: "Package 1",
    retailWithoutTax: retailAmount,
    retailAmount: orderAmount,
    discountPercentage: discountPercentage,
    discountAmount: discountAmount,
    taxPercentage: taxPercentage,
    taxAmount: taxAmount,
    totalAmount: totalPayableAmount,
    key_id: context.env.RAZORPAY_KEY_ID,
  };
};

// Function to check and return coupon discount percentage
const helperCheckCoupon = async (context, req, res) => {
  try {
    const { coupon_code } = req.body;
    let { database } = context;
    let percentage = 0;

    const coupon = await database("coupons")
      .select("*")
      .where("coupon_code", "=", coupon_code)
      .where("valid", "=", true)
      .limit(1);

    if (coupon.length > 0) {
      percentage = coupon[0].percentage;
    }

    return percentage;
  } catch (error) {
    return 0;
  }
};

const helperCreateOrder = async (context, req, amount) => {
  const user_id = req.accountability.user;
  const key_id = req.body.key_id;

  if (key_id !== context.env.RAZORPAY_KEY_ID) {
    throw new Error("Invalid Key ID");
  }

  if (!amount || amount <= 0) {
    throw new Error("Invalid amount");
  }

  const razorpay = new Razorpay({
    key_id: context.env.RAZORPAY_KEY_ID,
    key_secret: context.env.RAZORPAY_KEY_SECRET,
  });

  const order = await razorpay.orders.create({
    amount: amount,
    currency: "INR",
    payment_capture: 1,
    notes: {
      user_id,
      expected_amount: parseInt(amount, 10),
    },
  });

  const orderDetails = getOrderDetails(
    context,
    req.body.discount_percentage || 0
  );

  const meta = {
    razorpay_details: {
      order_id: order.id,
      payment_id: null,
      razorpay_signature: null,
    },
    status: "pending",
    test_id: null,
    order_created_on: new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      dateStyle: "short",
      timeStyle: "short",
    }),
    payment_verified_on: null,
    order_details: {
      user_id,
      name: orderDetails.name,
      retailAmount: orderDetails.retailAmount,
      discountPercentage: orderDetails.discountPercentage,
      discountAmount: orderDetails.discountAmount,
      taxPercentage: orderDetails.taxPercentage,
      taxAmount: orderDetails.taxAmount,
      totalPayableAmount: amount / 100,
      coupon_code: req.body.coupon_code || null,
    },
  };

  // Store order details in database
  let { database } = context;
  await database("payments").insert({
    user_id: user_id,
    meta: JSON.stringify(meta),
  });

  return order;
};

const helperVerifyPayment = async (context, req, res) => {
  const { order_id, payment_id, razorpay_signature } = req.body;

  let { database } = context;

  // Fetch the stored payment record using JSON_EXTRACT
  const storedPayment = await database("payments")
    .whereRaw('json_extract(meta, "$.razorpay_details.order_id") = ?', [
      order_id,
    ])
    .first();

  if (!storedPayment) {
    throw new Error("Invalid order");
  }

  const data = `${order_id}|${payment_id}`;

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(data)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    throw new Error("Invalid signature");
  }

  const payment = await razorpay.payments.fetch(payment_id);

  // Compare the fetched amount with the expected amount
  const expectedAmount =
    JSON.parse(storedPayment.meta).order_details.totalPayableAmount * 100;

  if (parseInt(payment.amount, 10) !== expectedAmount) {
    throw new Error("Payment amount mismatch");
  }
  if (payment.status !== "captured") {
    throw new Error("Payment not captured");
  }

  const paymendetails = await database("payments")
    .where("id", storedPayment.id)
    .first();

  const paymentMeta = JSON.parse(paymendetails.meta);
  console.log("paymentMeta", paymentMeta);
  console.log("status", paymentMeta.status);

  let oldStatus = false;
  if (paymentMeta.status === "completed") {
    oldStatus = true;
  }

  // Update the payment record with payment details
  const updatedMeta = {
    ...JSON.parse(storedPayment.meta),
    razorpay_details: {
      order_id,
      payment_id,
      razorpay_signature,
    },
    status: "completed",
    payment_verified_on: new Date().toISOString(),
  };

  await database("payments")
    .where("id", storedPayment.id)
    .update({
      meta: JSON.stringify(updatedMeta),
    });

  return { isValidSignature: true, payment, oldStatus };
};

const helperSetNewTest = async (context, req) => {
  const user_id = req.accountability.user;
  const { order_id, payment_id, razorpay_signature } = req.body;

  let { database } = context;

  const [new_test_id] = await database("test").insert({
    user_id,
  });

  // genrating invoice id and updating it in database

  const currentDate = new Date();
  currentDate.setHours(currentDate.getHours() + 5);
  currentDate.setMinutes(currentDate.getMinutes() + 30);

  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, "0");
  const day = String(currentDate.getDate()).padStart(2, "0");

  const invoiceId = `INV-${year}${month}${day}-${new_test_id}`;
  console.log("invoidId", invoiceId);

  // Fetch the existing payment record
  const paymentRecord = await database("payments")
    .whereRaw('json_extract(meta, "$.razorpay_details.order_id") = ?', [
      order_id,
    ])
    .first();

  if (!paymentRecord) {
    throw new Error("Payment record not found");
  }

  const existingMeta = JSON.parse(paymentRecord.meta);

  // Update the meta object with new test_id and other details
  const updatedMeta = {
    ...existingMeta,
    razorpay_details: {
      ...existingMeta.razorpay_details,
      order_id,
      payment_id,
      razorpay_signature,
    },
    status: "completed",
    test_id: new_test_id,
    invoice_id: invoiceId,
    payment_verified_on: new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      dateStyle: "short",
      timeStyle: "short",
    }),
  };

  // Update payment record with new test_id
  await database("payments")
    .where("id", paymentRecord.id)
    .update({
      meta: JSON.stringify(updatedMeta),
      test_id: new_test_id,
    });

  return new_test_id;
};
export {
  getOrderDetails,
  helperCheckCoupon,
  helperCreateOrder,
  helperSetNewTest,
  helperVerifyPayment,
};
