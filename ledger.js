const { Command, Option } = require("commander");
const program = new Command();

let transactions = [];
let prices = new Map();
//SOFTWARE DESCRIPTION
program.name("ledger-cli").description("CLI ledger to manage your finances by Jesus Murguia");

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
	.addOption(new Option("--price-db <string>", "The file for the prices database").default("prices_db"))
	.addOption(new Option("--file, -f <string>", "The file(s) for the ledger accounts").default("index.ledger"))
	.addOption(new Option("--sort, -S <string>", "Sort a report by date").choices(["d", "date", "amount", "a"]))
	.addOption(new Option("--begin, -b <string>", "Limit the report by the starting date"))
	.addOption(new Option("--end, -e <string>", "Limit the report by the ending date"))
	.addOption(new Option("--market, -V", "Show the market value"));

program.parse(process.argv);

function handleRegister(accounts, options) {
	let logs = getTransactions(options.F);
	if (options.B || options.E) logs = limitLogs(options.B, options.E, logs);
	if (options.S === "d" || options.S === "date") logs = sortByDate(logs);
	let totals = new Map();
	let sum = "0";
	let rows = [];
	for (let i = 0; i < logs.length; i++) {
		let { date, title, entries } = logs[i];
		let { account, amount, commodity } = entries[0];
		let first = true;
		if (program.opts().V) commodity = prices.get("DEFAULT");
		//set the total sum of this commodity
		let newAmount = updateAmount(getValue(amount), totals.get(commodity) || "0", commodity, "+");
		if (checkRegex(account)) totals.set(commodity, newAmount);
		sum = updateAmount(getValue(amount), sum || "0", commodity, "+");
		//push the row into the array to be printed later
		if (checkRegex(account)) {
			rows.push([first ? `${date} ${title}     ` : "", account, getValue(amount), newAmount]);
			first = false;
		}
		//print the rest of the totals
		if (checkRegex(account)) {
			const iterator = totals[Symbol.iterator]();
			for (const value of iterator) {
				if (value[0] !== commodity && Number(value[1].match(/[-\d\., ]/g).join("")) !== 0)
					rows.push([" ", " ", "", getValue(value[1])]);
			}
		}
		for (let j = 1; j < entries.length; j++) {
			let { account, amount, commodity } = entries[j];
			if (program.opts().V) commodity = prices.get("DEFAULT");
			if (amount !== "EMPTY") {
				//set the total sum of this commodity
				let newAmount = updateAmount(getValue(amount), totals.get(commodity) || "0", commodity, "+");
				if (checkRegex(account)) totals.set(commodity, newAmount);
				sum = updateAmount(getValue(amount), sum || "0", commodity, "+");
				//push the row into the array to be printed later
				if (checkRegex(account)) {
					rows.push([first ? `${date} ${title}     ` : "", account, getValue(amount), newAmount]);
					first = false;
				}
				//print the rest of the totals
				if (checkRegex(account)) {
					const iterator = totals[Symbol.iterator]();
					for (const value of iterator) {
						if (value[0] !== commodity && Number(value[1].match(/[-\d\., ]/g).join("")) !== 0)
							rows.push([" ", " ", "", getValue(value[1])]);
					}
				}
			} else {
				if (!checkRegex(account)) continue;
				//get the last values
				let last = entries[j - 1];
				if (program.opts().V) last.commodity = prices.get("DEFAULT");
				sum = updateAmount(sum || "0", "-1", last.commodity, "*");
				//set the total sum of this account by adding this entries amount
				let newAmount = updateAmount(
					sum,
					totals.get(last.commodity) || formatAmount("0", last.amount, last.commodity),
					last.commodity,
					"+"
				);
				totals.set(last.commodity, newAmount);
				//push the row into the array to be printed later
				rows.push([first ? `${date} ${title}     ` : "", account, getValue(sum), getValue(newAmount)]);
				first = false;
				//print the rest of the totals
				const iterator = totals[Symbol.iterator]();
				for (const value of iterator) {
					if (value[0] !== last.commodity && Number(value[1].match(/[-\d\., ]/g).join("")) !== 0)
						rows.push([" ", " ", "", getValue(value[1])]);
				}
			}
		}
		sum = 0;
		first = true;
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
		if (checkRegex(value[0])) rows.push([getValue(value[1]), value[0]]);
		else totals.delete(value[0]);
	}
	rows.push(["-----------", ""]);
	const iterator2 = sumCommodities(totals)[Symbol.iterator]();
	for (const value of iterator2) {
		rows.push([getValue(value[1]), ""]);
	}
	var table = require("text-table");
	var t = table(rows, { align: ["r", "l"] });
	console.log(t);
}

function handlePrint(accounts, options) {
	let logs = getTransactions(options.F);
	logs = filterLogs(logs);
	if (options.S === "d" || options.S === "date") logs = sortByDate(logs);
	if (options.S === "d") logs = sortByDate(logs);
	let rows = [];
	for (let i = 0; i < logs.length; i++) {
		let { date, title, entries } = logs[i];
		rows.push([`${date} ${title}`]);
		for (let j = 0; j < entries.length; j++) {
			let { account, amount } = entries[j];
			rows.push([`	${account}	`, `${amount === "EMPTY" ? "" : getValue(amount)}`]);
		}
		rows.push([""]);
	}
	var table = require("text-table");
	var t = table(rows, { align: ["l", "l"] });
	console.log(t);
}

//This function reads everyfile line by line, saves each transactions into an object and puts them into an array
function getTransactions(file) {
	getPrices();
	const lineByLine = require("n-readlines");
	let transaction = transactionFactory();
	const liner = new lineByLine(file);

	let line;

	while ((line = liner.next())) {
		//if this line says it includes another file it will loop through that file and come back to the next line
		let currentLine = line.toString("ascii");
		if (currentLine.includes("!include")) getTransactions(currentLine.split(" ")[1].replaceAll("\r", ""));
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
					.split(/[\t]|[ ]{2,}/)
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
			prices.set("DEFAULT", arr[arr.length - 1]);
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
		let comodity = program.opts().V ? prices.get("DEFAULT") : value[1].replace(/[-\d\., ]/g, "").trim();
		let newAmount = value[1];
		if (commodities.get(comodity)) {
			newAmount = updateAmount(
				getValue(value[1]),
				commodities.get(program.opts().V ? prices.get("DEFAULT") : comodity),
				program.opts().V ? prices.get("DEFAULT") : comodity,
				"+"
			);
		}
		commodities.set(program.opts().V ? prices.get("DEFAULT") : comodity, getValue(newAmount));
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
	if (prices.get(commodity)) return updateAmount(prices.get(commodity), amount, prices.get("DEFAULT"), "*");
	return;
}

function getValue(str) {
	if (!program.opts().V) return str;
	return convertCommodity(str);
}

function sortByAmount(totals) {
	let sorted = new Map(
		[...totals.entries()].sort((a, b) =>
			getNumber(convertCommodity(b[1])) >= getNumber(convertCommodity(a[1])) ? 1 : -1
		)
	);
	return sorted;
}

function limitLogs(begin, end, logs) {
	logs = logs.filter((l) => {
		if (begin) {
			return new Date(l.date).getTime() > new Date(begin).getTime();
		} else if (end) {
			return new Date(l.date).getTime() < new Date(end).getTime();
		}
		return true;
	});
	return logs;
}
