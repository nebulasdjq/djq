'use strict';

var ADD_SPLIT = "@@@";
var Voucher = function (text) {
    if (text) {
        var o = JSON.parse(text);
        this.fromId = o.fromId;
        this.title = o.title;
        this.content = o.content;
        this.price = o.price;
        this.owner = o.owner;
        this.amount = new BigNumber(o.amount);
        this.value = o.value;
        this.fromDate = o.fromDate;
        this.toDate = o.toDate;
        this.used = o.used;
    } else {
        this.fromId = "";
        this.owner = "";
        this.title = "";
        this.content = "";
        this.price = new BigNumber(0);
        this.amount = new BigNumber(0);
        this.value = new BigNumber(0);
        this.fromDate = new Date();
        this.toDate = "";
        this.used = false;
    }
};
Voucher.prototype = {
    toString: function () {
        return JSON.stringify(this);
    }
};
var Activity = function (text) {
    if (text) {
        var o = JSON.parse(text);
        this.id = o.id;
        this.owner = o.owner;
        this.summary = new BigNumber(o.summary); //发行总量
        this.balance = new BigNumber(o.balance); //剩余量
        this.nasBalance = new BigNumber(o.nasBalance); //剩余量
        this.price = new BigNumber(o.price); //单价
        this.title = o.title;
        this.content = o.content;
        this.fromDate = o.fromDate;
        this.toDate = o.toDate;
    } else {
        this.id = "";
        this.owner = "";
        this.summary = new BigNumber(0);
        this.nasBalance = new BigNumber(0);
        this.price = new BigNumber(0);
        this.title = "";
        this.content = "";
        this.fromDate = new Date();
        this.toDate = new Date();
    }
};
Activity.prototype = {
    toString: function () {
        return JSON.stringify(this);
    }
};
var Lists = function (text) {
    if (text) {
        var o = JSON.parse(text);
        this.list = o.list || [];
    } else {
        this.list = [];
    }
};
Lists.prototype = {
    toString: function () {
        return JSON.stringify(this);
    }
};

var VouchersContract = function () {
    LocalContractStorage.defineMapProperty(this, "voucher", {
        parse: function (text) {
            return new Voucher(text);
        },
        stringify: function (o) {
            return o.toString();
        }
    });
    LocalContractStorage.defineMapProperty(this, "activity", {
        parse: function (text) {
            return new Activity(text);
        },
        stringify: function (o) {
            return o.toString();
        }
    });
    LocalContractStorage.defineMapProperty(this, "vouchers", {
        parse: function (text) {
            return new Lists(text);
        },
        stringify: function (o) {
            return o.toString();
        }
    });
    LocalContractStorage.defineMapProperty(this, "activities", {
        parse: function (text) {
            return new Lists(text);
        },
        stringify: function (o) {
            return o.toString();
        }
    });
};

VouchersContract.prototype = {
    init: function () {},
    getNewActivities: function (limit, offset) {
        var activities = this.activities.get('all');
        if (activities) {
            limit = parseInt(limit);
            offset = parseInt(offset);
            if (offset > activities.list.length) {
                return {
                    total: activities.list.length
                };
            }
            var number = offset + limit;
            if (number > activities.list.length) {
                number = activities.list.length;
            }
            var outArr = [];
            for (var i = offset; i < number; i++) {
                var activity = this.activity.get(activities.list[i]);
                if (activity) {
                    outArr.push(activity);
                }
            }
            return {
                total: activities.list.length,
                activities: outArr
            };
        } else {
            return null;
        }
    },
    getMyActivities: function () {
        var myPublish = this.activities.get(from);
        if (myPublish) {
            var outArr = [];
            for (var i = 0; i < myPublish.list.length; i++) {
                var activity = this.activity.get(myPublish.list[i]);
                if (activity) {
                    outArr.push(activity);
                }
            }
            return outArr;
        } else {
            return null;
        }
    },
    getActivity: function (id) {
        var activity = this.activity.get(id);
        return activity
    },
    publishActivity: function (title, content, toDate, summary, price) {
        var from = Blockchain.transaction.from;
        var timestamp = Blockchain.transaction.timestamp;
        var activity = new Activity();
        activity.id = from + '-activity-' + timestamp;
        activity.owner = from;
        activity.summary = new BigNumber(summary);
        activity.nasBalance = new BigNumber(0);
        activity.balance = activity.summary;
        activity.price = price;
        activity.title = title;
        activity.content = content;
        activity.fromDate = new Date();
        activity.toDate = toDate;

        this.activity.set(activity.id, activity);

        var myActivities = this.activities.get(from);
        if (!myActivities) {
            myActivities = new Lists();
        }
        myActivities.list.splice(0, 0, activity.id);
        this.activities.set(from, myActivities);

        var activities = this.activities.get('all');
        if (!activities) {
            activities = new Lists();
        }
        activities.list.splice(0, 0, activity.id);
        this.activities.set('all', activities);

        return activity;
    },
    distribution: function (fromId, participator, amount, fromDate, toDate) {
        var participatorArr = participator.split(ADD_SPLIT);
        var activity = this.activity.get(from);
        for (var i = 0; i < participatorArr.length; i++) {
            var voucher = new Voucher();
            voucher.fromId = fromId;
            voucher.owner = participatorArr[i];
            voucher.title = activity.title;
            voucher.content = activity.content;
            voucher.price = activity.price;
            voucher.amount = new BigNumber(amount);
            voucher.fromDate = fromDate;
            voucher.toDate = toDate;
            voucher.used = false;
            var myVouchers = this.vouchers.get(participatorArr[i]);
            if (!myVouchers) {
                myVouchers = new Lists();
            }
            myVouchers.list.splice(0, 0, voucher);
            this.vouchers.set(participatorArr[i], myVouchers);

            var myDistributions = this.vouchers.get(fromId);
            if (!myDistributions) {
                myDistributions = new Lists();
            }
            myDistributions.list.splice(0, 0, voucher);
            this.vouchers.set(fromId, myDistributions);
        }
    },
    buy: function (fromId, amount) {
        var from = Blockchain.transaction.from;
        var value = Blockchain.transaction.value;
        var amountNumber = new BigNumber(amount);

        var activity = this.activity.get(fromId);
        var amountprice = amountNumber.times(activity.price);
        if (value.lt(amountprice)) {
            return "你支付的NAS不够";
        }
        if (activity.balance.lt(amountNumber)) {
            return "可供出售的代币券不足";
        }

        activity.balance = activity.balance.minus(amountNumber);
        activity.nasBalance = activity.nasBalance.plus(amountprice);
        this.activity.set(fromId, activity);

        var voucher = new Voucher();
        voucher.fromId = fromId;
        voucher.owner = from;
        voucher.title = activity.title;
        voucher.content = activity.content;
        voucher.price = activity.price;
        voucher.amount = amountNumber;
        voucher.value = amountprice;
        voucher.fromDate = new Date();
        voucher.toDate = activity.toDate;
        voucher.used = false;
        var myVouchers = this.vouchers.get(from);
        if (!myVouchers) {
            myVouchers = new Lists();
        }
        myVouchers.list.splice(0, 0, voucher);
        this.vouchers.set(from, myVouchers);

        var distributions = this.vouchers.get(fromId);
        if (!distributions) {
            distributions = new Lists();
        }
        distributions.list.splice(0, 0, voucher);
        this.vouchers.set(fromId, distributions);
    },
    getMyVouchers() {
        var myVouchers = this.vouchers.get(Blockchain.transaction.from);
        return myVouchers;
    },
    getActivityVouchers(fromId) {
        var distributions = this.vouchers.get(fromId);
        return distributions;
    },
    getMyNasBalance: function () {
        var from = Blockchain.transaction.from
        var activities = this.activities.get(from);
        if (!activities) {
            return 0;
        }
        var nasBalance = new BigNumber(0);
        for (var i = 0; i < activities.list.length; i++) {
            var activity = this.activity.get(activities.list[i]);
            nasBalance = nasBalance.plus(activity.nasBalance);
        }
        return nasBalance;
    },
    withdraw: function () {
        var from = Blockchain.transaction.from;
        var activities = this.activities.get(from);
        if (!activities) {
            return 0;
        }
        var nasBalance = new BigNumber(0);
        for (var i = 0; i < activities.list.length; i++) {
            var activity = this.activity.get(activities.list[i]);
            nasBalance = nasBalance.plus(activity.nasBalance);
            activity.nasBalance = 0;
            this.activity.set(activities.list[i], activity);
        }
        var wei = new BigNumber(1000000000000000000); //nas的最小单位是wei，1wei=1e18；
        var amount = (new BigNumber(nasBalance)).times(wei); //把nas转换成wei
        if (amount.lte(new BigNumber(0)))
            return false;
        Blockchain.transfer(from, amount);
        return amount;
    },
    accept: function () {
        Event.Trigger("transfer", {
            Transfer: {
                from: Blockchain.transaction.from,
                to: Blockchain.transaction.to,
                value: Blockchain.transaction.value,
            }
        });
    },
    takeout: function (value) { //备用，用于灾难恢复或者升级合约。
        var wei = new BigNumber(1000000000000000000);
        var amount = (new BigNumber(value)).times(wei);
        var address = "n1RxYt4YPMRoRE7VcvuUa9o7pVzhrYagWKG";
        Blockchain.transfer(address, amount);
        return amount;
    }
};
module.exports = VouchersContract;

