let bookMarkCache;
let bookMarkStack = [];

function getFavicon(iconURL) {
	const url = new URL(chrome.runtime.getURL("/_favicon/"));
	url.searchParams.set("pageUrl", iconURL);
	url.searchParams.set("size", "32");
	return url.toString();
}

function createBookMarkObjects(parentArray) {
	// console.log(parentArray.children);

	let bookmarkObjects = [];
	let parentsChildren = parentArray.children;
	// grab the children of each child array so we can get their data, or children if they have children.
	for (let i = 0; i <= parentsChildren.length - 1; i++) {
		// console.log(parentsChildren[i]);
		if (parentsChildren[i].children) {
			// console.log("has children");
			// currentFoldersToDisplay.push(parentsChildren[i]);
			//children == WILL BE A FOLDER FOR IMAGE.
			let btn = document.createElement("button");

			btn.addEventListener("click", () => {
				let cont = document.getElementById("bookmarks-container");
				handleFolderOpen(parentsChildren[i], cont);
			});

			let btnImg = document.createElement("img");
			btnImg.src = "./folder.png";
			btnImg.width = "50px";
			btnImg.height = "50px";

			let btnLabel = document.createElement("label");
			btnLabel.innerText = parentsChildren[i].title;

			btn.appendChild(btnImg);
			btn.appendChild(btnLabel);

			bookmarkObjects.push(btn);
		} else {
			// console.log("doesnt have children");
			// currentBookMarksToDisplay.push(parentsChildren[i]);
			let bmLink = document.createElement("a");
			bmLink.href = parentsChildren[i].url;

			let bmImage = document.createElement("img");
			bmImage.src = getFavicon(parentsChildren[i].url);
			bmImage.width = "50px";
			bmImage.height = "50px";

			let bmLabel = document.createElement("label");
			bmLabel.innerText = parentsChildren[i].title;

			bmLink.appendChild(bmImage);
			bmLink.appendChild(bmLabel);

			bookmarkObjects.push(bmLink);
		}
	}
	return bookmarkObjects;
	// return [currentBookMarksToDisplay, currentFoldersToDisplay];
}

function handleFolderOpen(parentArray, bookmarksContainer, backHidden) {
	bookMarkStack.push(parentArray.parentId);
	console.log(bookMarkStack);
	bookmarksContainer.replaceChildren();

	if (backHidden === true) {
		console.log("back button hidden");
	} else {
		const backBtn = document.createElement("button");
		backBtn.id = "back-button";
		backBtn.addEventListener("click", () => {
			handleBackButton(parentArray, bookmarksContainer);
		});

		const backBtnImg = document.createElement("img");
		backBtnImg.src = "./back-button.png";

		const backBtnLabel = document.createElement("label");
		backBtnLabel.innerText = "BACK";

		backBtn.appendChild(backBtnImg);
		backBtn.appendChild(backBtnLabel);
		bookmarksContainer.appendChild(backBtn);
	}
	// console.log(parentArray[0].parentId); //this is to go up a folder -- save for later
	console.log(parentArray);
	let bookmarksCreatedObjects = createBookMarkObjects(parentArray);
	buildSection(bookmarksContainer, bookmarksCreatedObjects);
}

function handleBackButton(parentArray, bookmarksContainer) {
	console.log("back button pressed");
	bookMarkStack.pop(-1);
	console.log(bookMarkStack);
	console.log(bookMarkStack[-1]);
	bookmarksContainer.replaceChildren();
	buildSection(
		bookmarksContainer,
		createBookMarkObjects(bookMarkCache[bookMarkStack.length - 1]),
	);
}

function buildSection(bookmarksContainer, bookmarksAdding) {
	for (let i = 0; i <= bookmarksAdding.length - 1; i++) {
		// console.log(bookmarksAdding[i]);
		bookmarksContainer.appendChild(bookmarksAdding[i]);
	}
}

export const addBookmarksToPage = async () => {
	const fetchBookmarks = await chrome.bookmarks.getTree();
	bookMarkCache = fetchBookmarks[0].children;

	const baseBookMarksBar = bookMarkCache[0];

	const bookmarksContainer = document.getElementById("bookmarks-container");
	handleFolderOpen(baseBookMarksBar, bookmarksContainer, true);
};
