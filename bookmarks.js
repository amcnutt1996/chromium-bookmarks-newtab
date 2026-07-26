async function fetchBookmarks() {
	const root = await chrome.bookmarks.getTree();
	const bookmarksBar = root[0].children[0].children;
	return bookmarksBar;
}

export const addBookmarksToPage = async () => {
	const loadedBookmarksBar = await fetchBookmarks();
	console.log(loadedBookmarksBar);
	const bookmarksContainer = document.getElementById("bookmarks-container");
	//TODO: add the images for the icons for each bookmark somehow
	for (let i = 0; i < loadedBookmarksBar.length; i++) {
		const bmarkLink = document.createElement("a");
		//const bmarkImage = document.createElement("img");
		const bmarkDiv = document.createElement("div");
		const bmarkLabel = document.createElement("label");

		bookmarksContainer.appendChild(bmarkLink);
		bmarkLink.appendChild(bmarkDiv);
		bmarkDiv.appendChild(bmarkLabel);

		bmarkDiv.setAttribute("class", "bookmark-div");
		bmarkLink.setAttribute("href", loadedBookmarksBar[i].url);
		bmarkLabel.innerText = loadedBookmarksBar[i].title;
	}
};

// chrome.bookmarks.getTree((tree) => {
// 	const bookmarkList = document.getElementById("bookmarkList");
// 	displayBookmarks(tree[0].children, bookmarkList);
// });

// // Recursively display the bookmarks
// function displayBookmarks(nodes, parentNode) {
// 	for (const node of nodes) {
// 		// If the node is a bookmark, create a list item and append it to the parent node
// 		if (node.url) {
// 			const listItem = document.createElement("li");
// 			listItem.textContent = node.title;
// 			parentNode.appendChild(listItem);
// 		}

// 		// If the node has children, recursively display them
// 		if (node.children) {
// 			const sublist = document.createElement("ul");
// 			parentNode.appendChild(sublist);
// 			displayBookmarks(node.children, sublist);
// 		}
// 	}
// }
