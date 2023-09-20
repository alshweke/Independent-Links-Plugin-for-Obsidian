import { PluginSettingTab, App, Setting, Notice,TFolder, MarkdownView} from "obsidian";
import IndependentLinkPlugin from "main";


export class LinkSettingTab extends PluginSettingTab {
    plugin: IndependentLinkPlugin;

	constructor(app: App, plugin: IndependentLinkPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}
    
	display() {
		let {containerEl} = this;
        containerEl.empty();
        
        containerEl.createEl('h1', {text: 'Settings for the Independent Link Plugin'});
        new Setting(containerEl)
        .setName("Create Web")
        .setDesc("Enter a name to create a new web")
        .addText((text) => {
            text.setPlaceholder('Enter a web Name');
            const inputEl = text.inputEl;
            const buttonContainer = inputEl.parentElement?.createDiv('button-container');
            const buttonEl = buttonContainer?.createEl('button');
            //buttonEl.style.marginBottom ='20px';
            buttonEl.style.transform = 'translateY(-35%)'
            buttonEl?.addClass('mod-cta');
            buttonEl?.setText('Create');
            buttonEl?.addEventListener('click', async() => {
            const inputValue = inputEl.value;
            if (!inputValue.trim()) {
                new Notice('Please enter a valid web name.');
                return;
            }
            const folderName = 'Webs Folder';
            // Find the folder by its name in the vault
            const folder = this.app.vault.getAbstractFileByPath(folderName);
            if (folder instanceof TFolder) {
                // Get a list of all files in the folder
                const files = folder.children;
                const existingWeb = files.find(file => file.name === `${inputValue}.json`);
                if (existingWeb) {
                new Notice('Web name already exists in "Webs Folder". Please choose another name.');
                return;
                }
            }  
            this.plugin.settings.textCreateWebName = inputValue;
            await this.plugin.createNewWeb();
            await this.plugin.saveSettings();
            this.display();
            new Notice(`The Web ${inputValue} was successfully created`)
            });
        });
       
        new Setting(containerEl)
        .setName("Import a web")
        .setDesc("Allow to import a web from your device")
        .addButton((button)=>{
            button
                .setButtonText('Import')
                .setClass('mod-cta')
                .onClick(async()=>{
                    await this.plugin.importWeb();
                    await this.plugin.saveSettings();
                    this.display();
                });
                
        });
        new Setting(containerEl)
        .setName("Select the active Web")
        .setDesc("Show all available webs in the vault; Switch to select the active web")
        .addDropdown((dropdown) => {
            const webs = this.app.vault.getFiles().filter((file) => file.path.startsWith("Webs Folder"));
            
            dropdown.addOption('',"Disabled")
            for(let i=0; i < webs.length;i++)
            {
                dropdown
                .addOption(webs[i].path, webs[i].basename)
                
            }
             dropdown
            .setValue(this.plugin.settings.currentWeb)
            .onChange((value) => {
                this.plugin.settings.currentWeb = value;
                this.plugin.saveSettings();
                this.display();
                this.plugin.refreshViews();
            });
        });

        
        containerEl.createEl('h4', {text: 'The active Web Management'});

        new Setting(containerEl)
        .setName("Rename web")
        .setDesc("Enter a new name for the active web")
        .addText((text) => {
            text.setPlaceholder('Enter a new Name');

            const inputEl = text.inputEl;
            const buttonContainer = inputEl.parentElement?.createDiv('button-container');
            const buttonEl = buttonContainer?.createEl('button');
            //buttonEl.style.marginBottom ='20px';
            buttonEl.style.transform = 'translateY(-35%)';
            buttonEl?.addClass('mod-cta');
            buttonEl?.setText('Rename');
            buttonEl?.addEventListener('click', async() => {
            const inputValue = inputEl.value;
            if (!inputValue.trim()) {
                new Notice('Please enter a valid name.');
                return;
            }
            const oldPath = this.plugin.settings.currentWeb;
        
            const oldName = oldPath.split('/').pop() || 'untitled';
    
            const newName = inputValue+'.json';
            const newPath = oldPath.split('/').slice(0, -1).concat(newName).join('/');
            // Check if the new file name already exists
            
            if (await this.app.vault.adapter.exists(newPath)) {
            new Notice(`File with name "${inputValue}" already exists. Please choose another name.`);
            return;
            }
    
            // Rename the file with the new name first
            await this.app.vault.adapter.rename(oldPath, newPath);
            this.plugin.settings.currentWeb = newPath;
            await this.plugin.saveSettings()

            const linkFilePath = this.plugin.settings.currentWeb;
            let content = await this.app.vault.adapter.read(linkFilePath);
            let webContent = JSON.parse(content);
            //rename the link
            webContent.webName = inputValue;
            const jsonContent = JSON.stringify(webContent);
            await this.app.vault.adapter.write(this.plugin.settings.currentWeb, jsonContent);

            
            this.display();
            new Notice(`The Link ${oldName} was successfully renamed to ${inputValue}`)
            });
        });

        new Setting(containerEl)
        .setName("Delete web")
        .setDesc("Delete the active web, if you want to delete anothe web, then select it as active")
        .addButton((button) => {
        button
          .setButtonText('Delete')
          .setClass('mod-cta')
          .onClick(async() => { 
            let WebPath = this.plugin.settings.currentWeb.split('/');
            let webName = WebPath[1]; 
            const confirmation = confirm(`Are you sure you want to delete the current ${webName}?`);
            if(confirmation){
            await this.app.vault.adapter.remove(this.plugin.settings.currentWeb);
            this.plugin.settings.currentWeb ='';
            this.plugin.saveSettings();
            this.display();
            new Notice(`The Web ${this.plugin.settings.currentWeb} was successfully deleted`)
            } else {
                new Notice('Delete is canceled');
            }
          });
          
        });

        new Setting(containerEl)
        .setName("Export Web")
        .setDesc("Export the active web, to export another web, make it the active")
        .addButton((button) => {
            
            button
              .setButtonText('Export')
              .setClass('mod-cta')
              .onClick(() => {
               const filePath = this.plugin.settings.currentWeb;
                this.plugin.exportWeb(filePath);
                this.plugin.saveSettings();
                this.display();
                
                
              });
        });
        
        
        containerEl.createEl('h4', {text: 'Links Management for the current active web'});
        // Add the dropdown menu
        new Setting(containerEl)
        .setName('Available Links')
        .setDesc('Show all links within the active web, Select a link to manage')
        .addDropdown(async(dropdown) => {
            const linkFilePath = this.plugin.settings.currentWeb;
            let content = await this.app.vault.adapter.read(linkFilePath);
            let web = JSON.parse(content);
            web.bidirectionalLinks.forEach((link) => {
                let linkName = link.linkName;
                dropdown
                .addOption(link.iD, linkName)

            })
            web.linksToPdfPage.forEach((link) => {
                let linkName = link.linkName;
                dropdown
                .addOption(link.iD, linkName)

            })
            web.externalLinks.forEach((externalLink) => {
                let linkName = externalLink.linkName;
                dropdown
                .addOption(externalLink.iD, linkName)

            })
            web.linksToHeading.forEach((headingLink) => {
                let linkName = headingLink.linkName;
                dropdown
                .addOption(headingLink.iD, linkName)
            })
            dropdown
            .setValue(this.plugin.settings.selectedLinkId)
            .onChange( (value) => {
                //@ts-ignore
                //console.log("Links inside the web",value)
                this.plugin.settings.selectedLinkId = value;
                 this.plugin.saveSettings();
                 this.display();
        });
        });

        new Setting(containerEl)
        .setName('Show link details')
        .setDesc('Show all details for the selected link')
        
        .addButton( async(button)=>{
            button.buttonEl.addClass('mod-cta');
            button.setButtonText("Show")
            const resultContainer = containerEl.createDiv();
            resultContainer.id = 'linkSearchInfoResult';
            const linkFilePath = this.plugin.settings.currentWeb;
            let webContent =  await this.app.vault.adapter.read(linkFilePath);
            let web = JSON.parse(webContent);
            let found = '';
            let linkIdInfo: any;
            if(web.bidirectionalLinks.find((link) => link.iD === this.plugin.settings.selectedLinkId)){
                linkIdInfo = web.bidirectionalLinks.find((link) => link.iD === this.plugin.settings.selectedLinkId);
                found = 'bidirectionalLinks'
            }else if(web.externalLinks.find((link) => link.iD === this.plugin.settings.selectedLinkId)){

                linkIdInfo = web.externalLinks.find((link) => link.iD === this.plugin.settings.selectedLinkId);
                found = 'externalLinks'
            }else if( web.linksToHeading.find((link) => link.iD === this.plugin.settings.selectedLinkId)){
                linkIdInfo = web.linksToHeading.find((link) => link.iD === this.plugin.settings.selectedLinkId);
                found = 'linksToHeading'

            } else if(web.linksToPdfPage.find((link)=> link.iD === this.plugin.settings.selectedLinkId)){
                linkIdInfo = web.linksToPdfPage.find((link) => link.iD === this.plugin.settings.selectedLinkId);
                found = 'linksToPdfPage'

            } else{
                console.log("not found")
            }
           


            
            //[${link.linkExplainer}](${link.nota}
            button.onClick(async () => {
                if(found === 'linksToPdfPage'){
                    resultContainer.innerHTML = `
                    <h4>Link details for '${linkIdInfo.linkName}':</h4>
                    <pre>
                        Link type: Link to pdf-page
                        The anchor selection: ${linkIdInfo.sourceText.selectedText}
                        Include in note: ${linkIdInfo.sourceText.noteName}
                        Destination PDF file: ${linkIdInfo.pdfNoteName}
                        Target page: ${linkIdInfo.targetPage}
                        Link created on: ${linkIdInfo.creationTime}
                        Link Keyword: ${linkIdInfo.linkKeyWord}
    
                    </pre>
                    `;
                } 
            if(found === 'bidirectionalLinks'){
                resultContainer.innerHTML = `
                <h4>Link details for '${linkIdInfo.linkName}':</h4>
                <pre>
                    Link type: Bidrectional link
                    First anchor selection: ${linkIdInfo.firstEndPoint.selectedText}
                    Include in note: ${linkIdInfo.firstEndPoint.noteName}
                    Second anchor selection: ${linkIdInfo.secondEndPoint.selectedText}
                    Include in note: ${linkIdInfo.secondEndPoint.noteName}
                    Link created on: ${linkIdInfo.creationTime}
                    Link Keyword: ${linkIdInfo.linkKeyWord}

                </pre>
                `;
            }
            if(found === 'externalLinks'){
                resultContainer.innerHTML = `
                <h4>Link details for '${linkIdInfo.linkName}':</h4>
                <pre>
                    Link type: External link
                    The anchor selection: ${linkIdInfo.sourceText.selectedText}
                    Include in note: ${linkIdInfo.sourceText.noteName}
                    Destination URL or Local file: ${linkIdInfo.URL}
                    Link created on: ${linkIdInfo.creationTime}
                    Link Keyword: ${linkIdInfo.linkKeyWord}

                </pre>
                `;
            }
            if(found === 'linksToHeading'){
                resultContainer.innerHTML = `
                <h4>Link details for '${linkIdInfo.linkName}':</h4>
                <pre>
                    Link type: Heading link
                    The anchor selection: ${linkIdInfo.sourceText.selectedText}
                    Include in note: ${linkIdInfo.sourceText.noteName}
                    Destination Heading name: ${linkIdInfo.headingName}
                    Include in note: ${linkIdInfo.headingNoteName}
                    Link created on: ${linkIdInfo.creationTime}
                    Link Keyword: ${linkIdInfo.linkKeyWord}

                </pre>
                `;
            }
            
            });
        })
        .addButton((async (button)=>{
            button.buttonEl.addClass('mod-cta');
            button
            .setButtonText("Hide")
            .onClick(()=>{
                const resultContainer = document.getElementById('linkSearchInfoResult');
                if (resultContainer) {
                    resultContainer.innerHTML = '';
                }
                });
            }));
       

        new Setting(containerEl)
        .setName("Move Link to another Web")
        .setDesc("Select a web from the menue to move the link to.")
        .addDropdown((dropdown) => {
            const webs = this.app.vault.getFiles().filter((file) => file.path.startsWith("Webs Folder"));
            dropdown.addOption('',"Disabled")
            for(let i=0; i < webs.length;i++)
            {
                dropdown
                .addOption(webs[i].path, webs[i].basename)
                
             }
             dropdown
            .setValue("Select Web") // defult
            .onChange((value) => {
                console.log("The selected Web",value)
                this.plugin.settings.targetWeb = value;
                
            });
            })
        .addButton((button) => {
            button.buttonEl.addClass('mod-cta');
            button
            .setButtonText("Move")
            .onClick(async () => {
              const selectedWeb = this.plugin.settings.targetWeb;
              
              
              await this.plugin.moveLinkToWeb();
              this.plugin.saveSettings();
                this.display();
              new Notice(`Link moved to "${selectedWeb}"`);
            });
        });

        
        new Setting(containerEl)
        .setName('Delete Link')
        .setDesc('Delete the selected link from the active web')
        .addButton((button) => {
        button
        .setButtonText('Delete')
        .setClass('mod-cta')
        .onClick( async() => {
            const confirmation = confirm('Are you sure you want to delete the link?');
            if(confirmation){
            const linkFilePath = this.plugin.settings.currentWeb;
            let content = await this.app.vault.adapter.read(linkFilePath);
            let webContent = JSON.parse(content);

            let noteToCheck =[];
            // bring the noteName of the deleted link
            const linkToDelete = webContent.bidirectionalLinks.find((link) => link.iD === this.plugin.settings.selectedLinkId) ||
                                    webContent.externalLinks.find((link) => link.iD === this.plugin.settings.selectedLinkId) ||
                                    webContent.linksToHeading.find((link) => link.iD === this.plugin.settings.selectedLinkId) ||
                                    webContent.linksToPdfPage.find((link) => link.iD === this.plugin.settings.selectedLinkId);
            if (webContent.bidirectionalLinks.includes(linkToDelete)){
                noteToCheck.push(linkToDelete.firstEndPoint.noteName)
                noteToCheck.push(linkToDelete.secondEndPoint.noteName)
            }
            else if(webContent.externalLinks.includes(linkToDelete)){
                noteToCheck.push(linkToDelete.sourceText.noteName)
            }
            else if(webContent.linksToHeading.includes(linkToDelete)){
                noteToCheck.push(linkToDelete.headingNoteName)
                noteToCheck.push(linkToDelete.sourceText.noteName)
            }
            else if(webContent.linksToPdfPage.includes(linkToDelete)){
                noteToCheck.push(linkToDelete.sourceText.noteName)
            }
            
            //delete one link
            const updatedLinks = webContent.bidirectionalLinks.filter((link) => link.iD !== this.plugin.settings.selectedLinkId);
            const updatedExternalLinks = webContent.externalLinks.filter((link) => link.iD !== this.plugin.settings.selectedLinkId);
            const updatedHeadingLinks = webContent.linksToHeading.filter((link) => link.iD !== this.plugin.settings.selectedLinkId);
            const updatedPdfLinks = webContent.linksToPdfPage.filter((link) => link.iD !== this.plugin.settings.selectedLinkId);
            webContent.bidirectionalLinks = updatedLinks;
            webContent.externalLinks = updatedExternalLinks;
            webContent.linksToHeading = updatedHeadingLinks;
            webContent.linksToPdfPage = updatedPdfLinks;
            //after removing the link, we need to delete its note
            for (const note of noteToCheck) {
                // Check if the noteName exists in any of the arrays
                const foundInLinks = webContent.bidirectionalLinks.find((link) => link.firstEndPoint.noteName === note ||link.secondEndPoint.noteName === note );
                const foundInExternalLinks = webContent.externalLinks.find((link) => link.sourceText.noteName === note);
                const foundInPdfLinks = webContent.linksToPdfPage.find((link) => link.sourceText.noteName === note);
                const foundInLinksToHeading = webContent.linksToHeading.find((link) => link.sourceText.noteName === note ||link.headingNoteName === note);
                if (!foundInLinks && !foundInExternalLinks && !foundInLinksToHeading && !foundInPdfLinks) {
                  
                   webContent.notes = webContent.notes.filter((notes)=> notes.noteName !== note)

                }
              }

            const jsonContent = JSON.stringify(webContent);
            await this.app.vault.adapter.write(this.plugin.settings.currentWeb, jsonContent);
            new Notice(`The Link is deleted`)
            //console.log("One link removed")
            this.plugin.saveSettings();
            this.display();
          }else{
            new Notice('Delete is canceled'); 
          }
        });
        });
        //
       
        new Setting(containerEl) 
        .setName('Link visibility')
        .setDesc('Turn on/off the selected link')   
        .addToggle(async(toggle) => {
                    const linkFilePath = this.plugin.settings.currentWeb;
                    let content = await this.app.vault.adapter.read(linkFilePath);
                    let web = JSON.parse(content);
                    let cc = -1;
                    let linktype = -1;
                    for(let i=0; i<web.bidirectionalLinks.length; i++){
                        if(web.bidirectionalLinks[i].iD === this.plugin.settings.selectedLinkId){
                            this.plugin.settings.linkEnableFeature = web.bidirectionalLinks[i].enableFeature;
                            cc = i;
                            linktype = 0;
                            break
                        }}
                    for(let i=0; i<web.externalLinks.length; i++){
                         if(web.externalLinks[i].iD === this.plugin.settings.selectedLinkId){
                            this.plugin.settings.linkEnableFeature = web.externalLinks[i].enableFeature;
                            cc = i;
                            linktype = 1;
                            break
                        }}
                    for(let i=0; i<web.linksToHeading.length; i++){
                         if(web.linksToHeading[i].iD === this.plugin.settings.selectedLinkId){
                            this.plugin.settings.linkEnableFeature = web.linksToHeading[i].enableFeature;
                            cc = i;
                            linktype = 2;
                            break
                        }

                    }
                    for(let i=0; i<web.linksToPdfPage.length; i++){
                        if(web.linksToPdfPage[i].iD === this.plugin.settings.selectedLinkId){
                           this.plugin.settings.linkEnableFeature = web.linksToPdfPage[i].enableFeature;
                           cc = i;
                           linktype = 3;
                           break
                       }}
                toggle
                .setValue(this.plugin.settings.linkEnableFeature)
                .onChange(async (value) => {
                    
            
                if(!value){
                        if(linktype == 0){ web.bidirectionalLinks[cc].enableFeature = false }
                        else if(linktype == 1){web.externalLinks[cc].enableFeature = false}
                        else if(linktype == 2){web.linksToHeading[cc].enableFeature = false}
                        else if(linktype == 3){web.linksToPdfPage[cc].enableFeature = false}
                        
                        
                        const jsonContent = JSON.stringify(web);
                        await this.app.vault.adapter.write(this.plugin.settings.currentWeb, jsonContent);
                        new Notice("link Disabled");
                        this.plugin.settings.linkEnableFeature = false;
                }
                else if(value)
                {
                    console.log("toggle value is true",value)
                    if(linktype == 0){web.bidirectionalLinks[cc].enableFeature = true}
                    else if(linktype == 1){web.externalLinks[cc].enableFeature = true}
                    else if(linktype == 2){web.linksToHeading[cc].enableFeature = true}
                    else if(linktype == 3){web.linksToPdfPage[cc].enableFeature = true}
                        
                        const jsonContent = JSON.stringify(web);
                        await this.app.vault.adapter.write(this.plugin.settings.currentWeb, jsonContent);
                        new Notice("link Enabled")
                        this.plugin.settings.linkEnableFeature = true;
                }
                //this.plugin.settings.linkEnableFeature = value;
                this.plugin.saveSettings();
                this.display();
        });
        });
        new Setting(containerEl)
        .setName('Links Style')
        .setDesc('toggle to change the link style')
        .addToggle(async(toggle)=>{
            toggle
                .setValue(this.plugin.settings.linkStyle)
                .onChange(async (value) => {
                if(!value){
                        this.plugin.settings.linkStyle = false;
                }
                else if(value)
                {
                        this.plugin.settings.linkStyle = true;
                }
                this.plugin.saveSettings();
                this.display();
                this.plugin.refreshViews();
                
                
                
        });
        });
    
        new Setting(containerEl)
            .setName("Rename Link")
            .setDesc("Enter a new name for the selected link")
            .addText((text) => {
                text.setPlaceholder('Enter a new Name');

            const inputEl = text.inputEl;
            const buttonContainer = inputEl.parentElement?.createDiv('button-container');
            
            const buttonEl = buttonContainer?.createEl('button');
            buttonEl.style.transform = 'translateY(-35%)';
            buttonEl?.addClass('mod-cta');
            buttonEl?.setText('Rename');

            buttonEl?.addEventListener('click', async() => {
            const inputValue = inputEl.value;
            if (!inputValue.trim()) {
                new Notice('Please enter a valid name.');
                return;
            }
            let oldName ='';
            const linkFilePath = this.plugin.settings.currentWeb;
            let content = await this.app.vault.adapter.read(linkFilePath);
            let webContent = JSON.parse(content);
            
            webContent.externalLinks.forEach((link) => {
                if(link.iD === this.plugin.settings.selectedLinkId)
                    {   
                        oldName = link.linkName
                        link.linkName = inputValue
                    }
            })
            webContent.linksToHeading.forEach((link) => {
                if(link.iD === this.plugin.settings.selectedLinkId)
                    {   
                        oldName = link.linkName
                        link.linkName = inputValue
                    }
            })
            webContent.bidirectionalLinks.forEach((link) => {
                if(link.iD === this.plugin.settings.selectedLinkId)
                    {   
                        oldName = link.linkName
                        link.linkName = inputValue
                    }
            })
            webContent.linksToPdfPage.forEach((link) => {
                if(link.iD === this.plugin.settings.selectedLinkId)
                    {   
                        oldName = link.linkName
                        link.linkName = inputValue
                    }
            })
            const jsonContent = JSON.stringify(webContent);
            await this.app.vault.adapter.write(this.plugin.settings.currentWeb, jsonContent);
            await this.plugin.saveSettings();
            this.display();
            new Notice(`The Link ${oldName} was successfully renamed to ${inputValue}`)
            });
            });      
        
        containerEl.createEl('h4', {text: 'Search Links'});
    
        new Setting(containerEl)
        .setName('Search Scope')
        .setDesc('Choose the scope for links search')
        .addDropdown((dropdown) => {
            dropdown
            .addOption('current', 'Current web')
            .addOption('all', 'All Webs')
            .setValue(this.plugin.settings.searchScope)
            .onChange((value) => {
                this.plugin.settings.searchScope = value;
            });
        });
        new Setting(containerEl)
        .setName("Search by Keyword")
        .setDesc("Enter a keyword to search for links.")
        .addText((text) => {
            text.setPlaceholder('Enter a keyword');

            const inputEl = text.inputEl;
            inputEl.addClass('search')
            const buttonContainer = inputEl.parentElement?.createDiv('button-container');
            
            const buttonEl = buttonContainer?.createEl('button');
            buttonEl.style.transform = 'translateY(-35%)';
            buttonEl?.addClass('mod-cta');
            buttonEl?.setText('Search');

            const resultContainer = containerEl.createDiv();
            resultContainer.id = 'linkSearchResult';

            buttonEl?.addEventListener('click', async () => {
            const keyword = inputEl.value;
            if (!keyword.trim()) {
                new Notice('Please enter a valid keyword.');
                return;
            }
            let linksWithKeyword = await this.plugin.searchLinksByKeyword(keyword,this.plugin.settings.searchScope);
            
            if(this.plugin.settings.searchScope ==='current'){
                
                const linksList = linksWithKeyword
                    .map((link) => `-Link name: ${link.linkName}`)
                    .join('\n');
        
                // Display the search result in the result container
                
                resultContainer.innerHTML = `<h4>Links with keyword "${keyword}":</h4><pre>${linksList}</pre>`;
            }
            else if(this.plugin.settings.searchScope ==='all'){
                
                const linksList = linksWithKeyword
                    .map((item) => `-Link name: ${item.link.linkName} / Exist in: ${item.web}`)
                    .join('\n');
                
                resultContainer.innerHTML = `<h4>Links with keyword "${keyword}":</h4><pre>${linksList}</pre>`;
                }
        
            });
        
        })
        .addButton((async (button)=>{
            button.buttonEl.addClass('mod-cta');
            button
            .setButtonText("Hide")
            .onClick(()=>{
                const resultContainer = document.getElementById('linkSearchResult');
                if (resultContainer) {
                    resultContainer.innerHTML = '';
                }
                });
        }));
    
    
        let searchSetting = new Setting(containerEl);
        searchSetting.setName('Search by a date')
        searchSetting.setDesc('Choose a date to search for links created on that date')
        
        const input1 = containerEl.createEl('input');
            input1.type = 'date';
            input1.addEventListener('input', () => {
            this.plugin.settings.selectedDate = '';
            this.plugin.settings.selectedDate = input1.value;
            })
            searchSetting.addButton((async (button)=>{

            button.buttonEl.addClass('mod-cta');
            button.setButtonText("Search")
            const resultDateContainer = containerEl.createDiv();
            
            resultDateContainer.id = 'linkSearchResultDate';
            button.onClick(async () => {
            let linksOnSelectedDate = await this.plugin.searchLinksByDate(this.plugin.settings.selectedDate,this.plugin.settings.searchScope);
                if(this.plugin.settings.searchScope ==='current'){
                    const linksList = linksOnSelectedDate
                    .map((link) => `-Link name: ${link.linkName}`)
                    .join('\n');
                    resultDateContainer.innerHTML = `<h5>Links on ${this.plugin.settings.selectedDate}:</h5><pre>${linksList}</pre>`;
                }
                else if(this.plugin.settings.searchScope ==='all'){
                    const linksList = linksOnSelectedDate
                        .map((item) => `-Link name: ${item.link.linkName} / Exist in: ${item.web}`)
                        .join('\n');
                        resultDateContainer.innerHTML = `<h5>Links on ${this.plugin.settings.selectedDate}:</h5><pre>${linksList}</pre>`;
                        
                    }
                    
                
                });
            
        }))
        searchSetting.addButton((async (button)=>{
            button.buttonEl.addClass('mod-cta');
            button
            .setButtonText("Hide")
            .onClick(()=>{
                const resultContainer = document.getElementById('linkSearchResultDate');
                    if (resultContainer) {
                        resultContainer.innerHTML = '';
                    }
                    input1.value = '';
                });
                
        }))
        
        
        
    }
    
}

