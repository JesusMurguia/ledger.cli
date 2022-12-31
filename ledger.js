const { Command } = require("commander");
const program = new Command();

let transactions = [];
let prices = new Map();
//SOFTWARE DESCRIPTION
program.name("ledger-cli").description("CLI ledger to manage your finances by Jesus Murguia").version("0.0.1");

//REGISTER COMMAND
program
	.command("register")
	.alias("reg")
	.description("Displays all the postings occurring in a single account.")
	.action(() => handleRegister(program.args, program.opts()));

//BALANCE COMMAND
program
	.command("balance")
	.alias("bal")
	.description("Displays the balances of every account in your journal.")
	.action(() => handleBalance(program.args, program.opts()));

//PRINT COMMAND
program
	.command("print")
	.alias("p")
	.description("Displays all the transactions in an alternative format.")
	.action(() => handlePrint(program.args, program.opts()));

//OPTIONS
program
	.option("--price-db <string>", "The file for the prices database", "prices_db")
	.option("--file, -f <string...>", "The file(s) for the ledger accounts", ["index.ledger"])
	.option("--sort, -S <string>", "Sort a report by date");

program.parse(process.argv);

function handleRegister(accounts, options) {
	let logs = getTransactions(options.F);
	logs = filterLogs(logs);
	if (options.S === "d") logs = sortByDate(logs);
	let totals = new Map();
	let sum = "0";
	let rows = [];
	for (let i = 0; i < logs.length; i++) {
		let { date, title, entries } = logs[i];
		let { account, amount, commodity } = entries[0];
		//set the total sum of this commodity
		let newAmount = updateAmount(amount, totals.get(commodity) || "0", commodity, "+");
		totals.set(commodity, newAmount);
		sum = updateAmount(amount, sum || "0", commodity, "+");
		//push the row into the array to be printed later
		rows.push([`${date} ${title}     `, account, amount, newAmount]);
		//print the rest of the totals
		const iterator = totals[Symbol.iterator]();
		for (const value of iterator) {
			if (value[0] !== commodity && Number(value[1].match(/[-\d\., ]/g).join("")) !== 0)
				rows.push([" ", " ", "", value[1]]);
		}
		for (let j = 1; j < entries.length; j++) {
			let { account, amount, commodity } = entries[j];
			if (amount !== "EMPTY") {
				//set the total sum of this commodity
				let newAmount = updateAmount(amount, totals.get(commodity) || "0", commodity, "+");
				totals.set(commodity, newAmount);
				sum = updateAmount(amount, sum, commodity, "+");
				//push the row into the array to be printed later
				rows.push(["", account, amount, newAmount]);
				//print the rest of the totals
				const iterator = totals[Symbol.iterator]();
				for (const value of iterator) {
					if (value[0] !== commodity && Number(value[1].match(/[-\d\., ]/g).join("")) !== 0)
						rows.push([" ", " ", "", value[1]]);
				}
			} else {
				//get the last values
				let last = entries[j - 1];
				//set the amount to be the total of the commodity
				amount = updateAmount(
					totals.get(last.commodity) || formatAmount("0", last.amount, last.commodity),
					"-1",
					last.commodity,
					"*"
				);
				sum = updateAmount(sum, "-1", last.commodity, "*");
				//set the total sum of this account by adding this entries amount
				let newAmount = updateAmount(
					sum,
					totals.get(last.commodity) || formatAmount("0", last.amount, last.commodity),
					last.commodity,
					"+"
				);
				totals.set(last.commodity, newAmount);
				//push the row into the array to be printed later
				rows.push(["", account, sum, newAmount]);
				//print the rest of the totals
				const iterator = totals[Symbol.iterator]();
				for (const value of iterator) {
					if (value[0] !== last.commodity && Number(value[1].match(/[-\d\., ]/g).join("")) !== 0)
						rows.push([" ", " ", "", value[1]]);
				}
			}
		}
		sum = 0;
	}
	var table = require("text-table");
	var t = table(rows, { align: ["l", "l", "r", "r"] });
	console.log(t);
}

//To find the balances of all of your accounts
function handleBalance(accounts, options) {
	let logs = getTransactions(options.F);
	let totals = new Map();
	let sum = "0";
	let rows = [];
	for (let i = 0; i < logs.length; i++) {
		for (let j = 0; j < logs[i].entries.length; j++) {
			let { account, amount, commodity } = logs[i].entries[j];
			if (amount !== "EMPTY") {
				//set the total sum of this commodity
				let newAmount = updateAmount(amount, totals.get(account) || "0", commodity, "+");
				totals.set(account, newAmount);

				sum = updateAmount(amount, sum.toString(), commodity, "+");
			} else {
				sum = updateAmount(sum.toString(), "-1", logs[i].entries[j - 1].commodity, "*");
				totals.set(account, sum);
				sum = "0";
			}
		}
		sum = "0";
	}
	if (options.S === "amount") totals = sortByAmount(totals);
	const iterator = totals[Symbol.iterator]();
	for (const value of iterator) {
		if (checkRegex(value[0])) rows.push([value[1], value[0]]);
		else totals.delete(value[0]);
	}
	rows.push(["-----------", ""]);
	const iterator2 = sumCommodities(totals)[Symbol.iterator]();
	for (const value of iterator2) {
		rows.push([value[1], ""]);
	}
	var table = require("text-table");
	var t = table(rows, { align: ["r", "l"] });
	console.log(t);
}

function handlePrint(accounts, options) {
	let logs = getTransactions(options.F);
	logs = filterLogs(logs);
	if (options.S === "d") logs = sortByDate(logs);
	let rows = [];
	for (let i = 0; i < logs.length; i++) {
		let { date, title, entries } = logs[i];
		rows.push([`${date} ${title}`]);
		for (let j = 0; j < entries.length; j++) {
			let { account, amount } = entries[j];
			rows.push([`	${account}	`, `${amount === "EMPTY" ? "" : amount}`]);
		}
		rows.push([""]);
	}
	var table = require("text-table");
	var t = table(rows, { align: ["l", "l"] });
	console.log(t);
}

//This function reads everyfile line by line, saves each transactions into an object and puts them into an array
function getTransactions(files) {
	getPrices();
	const lineByLine = require("n-readlines");
	//loop through every file declared in the command line options
	for (let i = 0; i < files.length; i++) {
		let transaction = transactionFactory();
		const liner = new lineByLine(files[i]);

		let line;

		while ((line = liner.next())) {
			//if this line says it includes another file it will loop through that file and come back to the next line
			let currentLine = line.toString("ascii");

			if (currentLine.includes("!include")) getTransactions([currentLine.split(" ")[1].replaceAll("\r", "")]);
			else {
				//trim the line to avoid empty spaces
				//this will also help identify new lines
				//to know when to end the current transaction
				currentLine = currentLine.trim();
				//if the next line is a comment ignore it
				if (currentLine[0] === ";") continue;

				//if theres an empty line we add the transaction to the list
				//and reset the transaction object
				if (currentLine.length === 0) {
					transactions.push(transaction);
					transaction = transactionFactory();
					continue;
				}

				//if the next line has a date in it
				//we save both the date and the title
				if (hasDate(currentLine)) {
					if (transaction.date) {
						transactions.push(transaction);
						transaction = transactionFactory();
					}
					const [date, title] = currentLine.split(/ (.*)/s);
					transaction.date = date;
					transaction.title = title;
				} else {
					//if it doesnt have a date, it has the account - amount pair
					//split the line by tabs and remove the empty ones
					let [account, amount] = currentLine
						.trim()
						.split("\t")
						.filter((n) => n);
					let commodity = "";
					if (amount) {
						commodity = amount.replace(/[-\d\., ]/g, "").trim();
						transaction.entries.push({ amount, commodity, account: account.trim() });
					} else {
						//if the amount is empty i gotta calculate the number myself
						transaction.entries.push({
							amount: "EMPTY",
							commodity: "EMPTY",
							account: account.trim(),
						});
					}
				}
			}
		}
		if (transaction.date) {
			transactions.push(transaction);
			transaction = transactionFactory();
		}
	}
	return transactions;
}

function getPrices() {
	const lineByLine = require("n-readlines");
	const liner = new lineByLine(program.opts().priceDb);
	let line;
	while ((line = liner.next())) {
		let arr = line.toString().trim().split(" ");
		if (line.toString().trim().startsWith("P")) {
			prices.set(arr[arr.length - 2], arr[arr.length - 1]);
		}
		if (line.toString().trim().startsWith("N")) {
			prices.set(arr[arr.length - 1], "1");
		}
	}
}

function hasDate(line) {
	const dateType = /(\d{4})([\/-])(\d{1,2})\2(\d{1,2})/;
	return dateType.test(line);
}
//return an empty transaction object
function transactionFactory() {
	let transaction = {
		date: "",
		title: "",
		entries: [],
	};
	return transaction;
}

function getNumber(str) {
	return Number(str.match(/[-\d\., ]/g).join(""));
}

function updateAmount(amount1, amount2, commodity, operation) {
	let num1 = getNumber(amount1);
	let num2 = getNumber(amount2);

	let res;
	if (operation === "+") res = Math.round((num1 + num2 + Number.EPSILON) * 100) / 100;
	if (operation === "*") res = Math.round((num1 * num2 + Number.EPSILON) * 100) / 100;

	return formatAmount(res, amount1, commodity);
}

function formatAmount(amount, format, commodity) {
	if (format.endsWith(commodity)) {
		return `${amount} ${commodity}`;
	} else if (amount < 0) {
		let arr = String(amount).split("");
		arr.splice(1, 0, commodity);
		return arr.join("");
	}
	return commodity + amount;
}

function sortByDate(logs) {
	logs.sort(function (a, b) {
		return new Date(a.date) - new Date(b.date);
	});
	return logs;
}

function checkRegex(str) {
	let arr = program.args;
	if (arr.length < 2) return true;
	let regex = new RegExp(arr.slice(1).join("|"), "g");
	let matches = str.match(regex) || [];
	return matches.length > 0;
}

function sumCommodities(totals) {
	let commodities = new Map();
	const iterator = totals[Symbol.iterator]();
	for (const value of iterator) {
		let comodity = value[1].replace(/[-\d\., ]/g, "").trim();
		let newAmount = value[1];
		if (commodities.get(comodity)) {
			newAmount = updateAmount(value[1], commodities.get(comodity), comodity, "+");
		}
		commodities.set(comodity, newAmount);
	}
	return commodities;
}

function filterLogs(logs) {
	let transactions = logs;
	let arr = program.args;
	if (arr.length < 2) return transactions;
	let regex = new RegExp(arr.slice(1).join("|"), "g");
	for (let i = 0; i < transactions.length; i++) {
		for (let j = 0; j < transactions[i].entries.length; j++) {
			let matches = transactions[i].entries[j].account.match(regex) || [];
			if (matches.length === 0) {
				transactions[i].entries.splice(j, 1);
				j--;
			}
		}
		if (transactions[i].entries.length === 0) transactions.splice(i--, 1);
	}
	return transactions;
}

function convertCommodity(amount) {
	let commodity = amount.replace(/[-\d\., ]/g, "").trim();
	if (prices.get(commodity)) return updateAmount(prices.get(commodity), amount, commodity, "*");
	return;
}

function sortByAmount(totals) {
	let sorted = new Map(
		[...totals.entries()].sort((a, b) =>
			getNumber(convertCommodity(b[1])) >= getNumber(convertCommodity(a[1])) ? 1 : -1
		)
	);
	return sorted;
}
