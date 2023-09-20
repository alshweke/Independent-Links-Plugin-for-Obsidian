import { Notice, Plugin, MarkdownView, Modal,Editor,TAbstractFile, TFile,TFolder } from 'obsidian';
import { LinkSettingTab } from 'Settings';
import { saveAs } from 'file-saver';
import { basename } from 'path';

class InvalidSelectionModal extends Modal {
  constructor(app: App) {
    super(app);
  }

  onOpen() {
    const modalContent = this.contentEl.createDiv({ cls: 'modal-content' });

    modalContent.createEl('h2', { text: 'Invalid Link selection' });
    modalContent.createEl('p', { text: 'Please select text on a single line.' });

    const closeButton = modalContent.createEl('button', { text: 'Close' });
    closeButton?.addClass('mod-cta');
    
    closeButton.addEventListener('click', () => {
      this.close();
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}


interface IndependentLinkPluginSettings {
	mySetting: string;
	textCreateWebName:string;
  currentWeb: string;
  targetWeb: string;
  selectedLinkId: string;
  linkEnableFeature:boolean;
  selectedDate:string;
  searchScope:string;
  linkStyle: boolean;
	
}

const DEFAULT_SETTINGS: Partial<IndependentLinkPluginSettings> = {
	mySetting: 'default',
  textCreateWebName:'',
  currentWeb:'Disabled',
  selectedLinkId:'',
  linkEnableFeature:true,
  selectedDate:'',
  targetWeb:'',
  searchScope:'',
  linkStyle: true
    
};

interface endPoint{
    selectedText: string;
    noteName: string;
    prefixText: string;
    suffixText: string;
    lineContent:string;
    lineNumber:string;
}
interface pdfPageLinkObject {
  iD:string;
  sourceText: endPoint;
  targetPage: string;
  pdfNoteName:string;
  creationTime: string;
  enableFeature:boolean;
  linkName: string;
  linkKeyWord: string;
}
interface HeadingLinkObject {
  iD:string;
  sourceText: endPoint;
  headingName: string;
  headingNoteName:string;
  creationTime: string;
  enableFeature:boolean;
  linkName: string;
  linkKeyWord: string;
}
interface ExternalLinkObject {
  iD:string;
  sourceText: endPoint;
  URL: string;
  creationTime: string;
  enableFeature:boolean;
  linkName: string;
  linkKeyWord: string;
}
interface BidirectionalLinkObject {
  iD:string;
  firstEndPoint: endPoint;
  secondEndPoint: endPoint;
  creationTime: string;
  enableFeature:boolean;
  linkName: string;
  linkKeyWord: string;
}
interface Note{
  noteName:string,
  noteContent:string
}
interface Web {
    webName: string;
    bidirectionalLinks: BidirectionalLinkObject[];
    externalLinks: ExternalLinkObject[];
    linksToHeading: HeadingLinkObject[];
    linksToPdfPage: pdfPageLinkObject[];
    notes: Note[];
}
let navigationTargetID="";
export default class IndependentLinkPlugin extends Plugin {
    private oldTitles: Map<string, string> = new Map();
    temporaryendPoint: endPoint= {selectedText: '', noteName: '', prefixText:'',suffixText: '',lineContent:'',lineNumber:''};
    temporaryLink: BidirectionalLinkObject = {
      iD:uuidv4(),
      firstEndPoint: this.temporaryendPoint,
      secondEndPoint: this.temporaryendPoint,
      creationTime: '',
      linkName: '',
      enableFeature:true,
      linkKeyWord:'',
    };
    temporaryLinkExternal: ExternalLinkObject = {
      iD:uuidv4(),
      sourceText: this.temporaryendPoint,
      URL: '',
      creationTime: '',
      linkName: '',
      enableFeature:true,
      linkKeyWord:''
    };
    temporaryLinkToHeading: HeadingLinkObject = {
      iD:uuidv4(),
      sourceText: this.temporaryendPoint,
      headingName: '',
      headingNoteName:'',
      creationTime: '',
      linkName: '',
      enableFeature:true,
      linkKeyWord:''
    };
    temporaryLinkToPdfPage: pdfPageLinkObject = {
      iD:uuidv4(),
      sourceText: this.temporaryendPoint,
      targetPage: '',
      pdfNoteName:'',
      creationTime: '',
      linkName: '',
      enableFeature:true,
      linkKeyWord:''
    }; 
    web: Web = {
      webName: "",
      bidirectionalLinks:[],
      externalLinks:[],
      linksToHeading:[],
      linksToPdfPage:[],
      notes:[]};
    settings: IndependentLinkPluginSettings;
    async loadSettings() {
      this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }
    async saveSettings() {
      await this.saveData(this.settings);
    }
    async onload() {
      
      // Register the event listener for metadata changes
      this.registerEvent(
          this.app.vault.on("modify", this.handleFileModify)
          
        );
      // Register the event listener for file rename changes
      this.registerEvent(
          this.app.vault.on("rename", this.handleFileRename)
      );
     
      
      this.registerEvent(this.app.workspace.on("file-open", this.findDanglingLinks.bind(this)));
      this.registerEvent(this.app.workspace.on('layout-change',this.findDanglingLinks.bind(this)));
      
      this.addRibbonIcon('broken-link', 'Show dangling links',() =>
      {
        this.findDanglingLinks();
        
      });

      this.addRibbonIcon("link","Open split view", async() => {
        this.openSplitView();
        
      });
      
      await this.loadSettings();
      this.addSettingTab(new LinkSettingTab(this.app, this));
      
     
      this.addCommand({
        id: 'select-first-endpoint',
        name: 'Start Bidirectional Link',
        editorCallback: (editor: Editor) => {
          if(!editor.somethingSelected()){
            new Notice("Please make the selection first")
          }
          else this.selectFirstEndpoint(editor);
        },
        hotkeys: [],
      });
      this.addCommand({
        id: 'select-second-endpoint',
        name: 'Complete Bidirectional Link',
        editorCallback: (editor: Editor) => {
          this.selectSecondEndpoint(editor);
        },
        hotkeys: [],

      });
      this.addCommand({
        id: 'Create-External-link',
        name: 'Create External link',
        editorCallback: (editor: Editor) => {
          this.createLinkTOExternalRecource(editor);
        },
        hotkeys: [],
      });
      this.addCommand({
        id: 'Create-Link-To-heading',
        name: 'Create link to a heading',
        editorCallback: (editor: Editor) => {
          this.createLinkToHeading(editor);
        },
        hotkeys: [],
      });
      this.addCommand({
        id: 'Create-Link-To-PDF-Page',
        name: 'Create link to a pdf-page',
        editorCallback: (editor: Editor) => {
          this.createLinkToPDFPage(editor);
        },
        hotkeys: [],
      });
      
      this.postProcessor();
      
    }
    
    openSplitView = async()=>{
      
      const activeLeaf = this.app.workspace.activeLeaf;
      if (activeLeaf && activeLeaf.view instanceof MarkdownView) {
        const viewState = activeLeaf.getViewState();
        console.log(viewState)
        let isEditMode = false;
        if (viewState.state?.mode === 'source') {
          isEditMode = true;
        }
        viewState.state.mode
        //viewState.group = this.app.workspace.activeLeaf;
        // Determine the mode of the new leaf
        const newLeafMode = isEditMode ? 'preview' : 'source';
        // Split the active leaf vertically
        const newLeaf = this.app.workspace.createLeafBySplit(activeLeaf, 'vertical');
        activeLeaf.setGroupMember(newLeaf);
        // Set the mode of the new leaf
        newLeaf.setViewState({
          ...viewState,
          state: {
            ...viewState.state,
            mode: newLeafMode,
          },
        });
        }
    }
    findDanglingLinks = async () =>{
      const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) return;
        setTimeout(async() => {
        const documentLinks = document.querySelectorAll<HTMLAnchorElement>('a.internal-link');
        const dangleLinks: HTMLAnchorElement[] = []; 
        const linkFilePath = this.settings.currentWeb;
        let webFile = await this.app.vault.adapter.read(linkFilePath);
        let webContent = JSON.parse(webFile);
        documentLinks.forEach((link) => {
              if(!link.id) return;
              if(link.getAttribute('type')==='bidirectional'){
              const linkDestination = link.getAttribute('data-href'); 
              const iD = link.getAttribute('id')
              const linkID = iD?.slice(0, -1);
              const findLink = webContent.bidirectionalLinks.find((link) => link.iD === linkID)
              //const findLink = webContent.bidirectionalLinks.find((link) => link.iD === linkID) || webContent.externalLinks.find((link) => link.iD === linkID) || webContent.linksToHeading.find((link) => link.iD === linkID)|| webContent.linksToPdfPage.find((link) => link.iD === linkID);
              if (!linkDestination || linkDestination.trim() === '' || !this.app.metadataCache.getFirstLinkpathDest(linkDestination, activeView.file.path)) {
                dangleLinks.push(link);
              }
              
              else 
              {if(findLink.firstEndPoint.noteName === linkDestination){
                //
                const searchForAnchor = findLink.firstEndPoint.prefixText + findLink.firstEndPoint.selectedText +findLink.firstEndPoint.suffixText;
                const note = webContent.notes.find((note: { noteName: string }) => note.noteName === linkDestination);
                if(!note.noteContent.includes(searchForAnchor)){
                  dangleLinks.push(link);
                }
              }
              if(findLink.secondEndPoint.noteName === linkDestination){
                const searchForAnchor = findLink.secondEndPoint.prefixText + findLink.secondEndPoint.selectedText +findLink.secondEndPoint.suffixText;
                const note = webContent.notes.find((note: { noteName: string }) => note.noteName === linkDestination);
                if(!note.noteContent.includes(searchForAnchor)){
                  dangleLinks.push(link);
                }
              }}}
              if(link.getAttribute('type')==='headingLink'){
                const inputString = link.getAttribute('data-href');
                const part = inputString?.split('#');
                const noteDestination =  part[0];
                const headingDestination = part[1]
                const iD = link.getAttribute('id')
                const findLink = webContent.linksToHeading.find((link) => link.iD === iD);
                console.log(this.app.metadataCache.getFirstLinkpathDest(noteDestination, activeView.file.path));
                if (!noteDestination || noteDestination.trim() === '' || !this.app.metadataCache.getFirstLinkpathDest(noteDestination, activeView.file.path)) {
                  dangleLinks.push(link);
                }
                else if (findLink.headingName === headingDestination){
                const note = webContent.notes.find((note: { noteName: string }) => note.noteName === noteDestination);
                const content = note.noteContent;
                const headings = getHeadingNames(content)
                if(!headings.includes(headingDestination)){
                  dangleLinks.push(link);
                }
                }
              }
              if(link.getAttribute('type')==='pdfLink'){
                const inputString = link.getAttribute('data-href');
                const parts = inputString?.split('#');
                const noteDestination =  parts[0];
                const iD = link.getAttribute('id')
                if (!noteDestination || noteDestination.trim() === '' || !this.app.metadataCache.getFirstLinkpathDest(noteDestination, activeView.file.path)) {
                  dangleLinks.push(link);
                }
              }
            });
        dangleLinks.forEach((link)=> {
          link.addClass('dangle-link');
          link.removeAttribute("aria-label");
          link.setAttribute('data-tooltip',`This Link [${link.getAttribute('label')}] is dangling`)
          
        });
      }, 150); 
    }
    
    handleFileModify = async (file: TAbstractFile) => {
      if (!(file instanceof TFile) || file.extension !== "md") return;
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (view) {
        const editor = view.editor;
        const modifiedNoteName = view.getDisplayText()
        const content = await this.app.vault.read(file);
        const folderName = 'Webs Folder';
        let filesPath =[];
        const folder = this.app.vault.getAbstractFileByPath(folderName);
          if (folder instanceof TFolder) {
            folder.children.forEach((child)=>{
              filesPath.push(child.path);
            })
          }

          for(let j =0; j<filesPath.length;j++)
          {
            let previousContent ="";
            let linkFilePath = filesPath[j]
          
            //  const linkFilePath = this.settings.currentWeb;
            let webContent = await this.app.vault.adapter.read(linkFilePath);
            let web = JSON.parse(webContent);
            let index= -1
            for(let i=0;i<web.notes.length;i++)
            {
              if(web.notes[i].noteName === modifiedNoteName)
              {
              previousContent = web.notes[i].noteContent;
              index = i;
              }
            }
            if (previousContent) {
              // Split the previous and new content into lines
              const previousLines = previousContent.split("\n");
              //console.log("previousLines ", previousLines)
              const newLines = content.split("\n");
              // Compare the previous and new lines
              for (let i = 0; i < newLines.length; i++) {
                if (newLines[i] !== previousLines[i]) {
                  // Line i has been changed
                  const lineNumber = i + 1; // Add 1 to convert from zero-based to one-based indexing
                  const beforeContent = previousLines[i];
                  const afterContent = newLines[i]
                  console.log(`Line ${lineNumber} changed:`);
                  console.log(`Before: ${beforeContent}`);
                  console.log(`After: ${afterContent}`);
                  //
                  web.bidirectionalLinks.forEach(link => {
                    
                    if(parseInt(link.firstEndPoint.lineNumber) === lineNumber && link.firstEndPoint.noteName === modifiedNoteName)
                    {
                      
                      if(link.firstEndPoint.lineContent === beforeContent)
                      {
                        if(afterContent.includes(link.firstEndPoint.prefixText + link.firstEndPoint.selectedText + link.firstEndPoint.suffixText)){
                          console.log("LINK content Ok! Just update the new Content");
                          link.firstEndPoint.lineContent = afterContent
                        } else{
                          const pattern = new RegExp(`${link.firstEndPoint.prefixText}(.*)${link.firstEndPoint.suffixText}`);
                        if(afterContent.includes(link.firstEndPoint.prefixText + link.firstEndPoint.selectedText))
                        {
                          //suffix changed
                          let col = afterContent.indexOf(link.firstEndPoint.prefixText + link.firstEndPoint.selectedText);
                          col = col+(link.firstEndPoint.prefixText + link.firstEndPoint.selectedText).length
                          
                          const suffixLine = afterContent.substring(col);
                          const wordsAfterSelection = suffixLine.split(" ");
                          link.firstEndPoint.suffixText = wordsAfterSelection.slice(0,5).join(" ");
                          link.firstEndPoint.lineContent = afterContent
                          console.log("Suffix updated, Line and content in note updated")
                          
                        }
                        else if(afterContent.includes(link.firstEndPoint.selectedText+ link.firstEndPoint.suffixText))
                        {
                          // prefix changed
                          let col= afterContent.indexOf(link.firstEndPoint.selectedText+ link.firstEndPoint.suffixText);
                          const prefixLine = afterContent.substring(0, col);
                          const wordsBeforeSelection = prefixLine.split(" ");
                          link.firstEndPoint.prefixText = wordsBeforeSelection.slice(-5).join(" ");
                          link.firstEndPoint.lineContent = afterContent
                          console.log("Prefix updated, Line and content in note updated")
                        }
                        // Create a regular expression pattern to match prefix + any string + suffix
                        
                        else if(afterContent.match(pattern)){
                          const match = afterContent.match(pattern)
                          //const startIndex = afterContent.indexOf(link.firstEndPoint.prefixText) + link.firstEndPoint.prefixText.length;
                          //const endIndex = afterContent.indexOf(link.firstEndPoint.suffixText);
                          //const extractedText = afterContent.slice(startIndex, endIndex);
                          const extractedText = match[1];
                          const similarityPercentage = calculateSimilarityPercentage(extractedText, link.firstEndPoint.selectedText);
                          

                          if (similarityPercentage > 50 ) {
                            link.firstEndPoint.selectedText = extractedText;
                            link.firstEndPoint.lineContent = afterContent
                            new Notice('Link reparing!')
                          } else{new Notice('The changes made on link was too much so the link will break');}
                        
                        }
                        }
                        
                        
                      }
                      
                    }
                    else if(link.firstEndPoint.lineContent === afterContent  && link.firstEndPoint.noteName === modifiedNoteName){
                      link.firstEndPoint.lineNumber = lineNumber.toString();
                    }
                    if(parseInt(link.secondEndPoint.lineNumber) === lineNumber  && link.secondEndPoint.noteName === modifiedNoteName)
                    {
                      if(link.secondEndPoint.lineContent === beforeContent)
                      {
                        if(afterContent.includes(link.secondEndPoint.prefixText + link.secondEndPoint.selectedText + link.secondEndPoint.suffixText)){
                          console.log("LINK content Ok! Just update the new Content");
                          link.secondEndPoint.lineContent = afterContent
                        }
                        else{
                          const pattern2 = new RegExp(`${link.secondEndPoint.prefixText}(.*)${link.secondEndPoint.suffixText}`);
                        if(afterContent.includes(link.secondEndPoint.prefixText + link.secondEndPoint.selectedText))
                        {
                          //suffix changed
                          let col = afterContent.indexOf(link.secondEndPoint.prefixText + link.secondEndPoint.selectedText);
                          col = col+(link.secondEndPoint.prefixText + link.secondEndPoint.selectedText).length
                          const suffixLine = afterContent.substring(col);
                          const wordsAfterSelection = suffixLine.split(" ");
                          link.secondEndPoint.suffixText = wordsAfterSelection.slice(0,5).join(" ");
                          link.secondEndPoint.lineContent = afterContent
                          console.log("Suffix updated, Line and content in note updated")
                        }
                        else if(afterContent.includes(link.secondEndPoint.selectedText+ link.secondEndPoint.suffixText))
                        {
                          //prefix changed
                          let col= afterContent.indexOf(link.secondEndPoint.selectedText+ link.secondEndPoint.suffixText);
                          const prefixLine = afterContent.substring(0, col);
                          const wordsBeforeSelection = prefixLine.split(" ");
                          link.secondEndPoint.prefixText=wordsBeforeSelection.slice(-5).join(" ");
                          link.secondEndPoint.lineContent = afterContent
                          console.log("Prefix updated, Line and content in note updated")
                        }
                        else if(afterContent.match(pattern2)){
                          const match = afterContent.match(pattern2)
                          const startIndex = afterContent.indexOf(link.secondEndPoint.prefixText) + link.secondEndPoint.prefixText.length;
                          const endIndex = afterContent.indexOf(link.secondEndPoint.suffixText);
                          //const extractedText = afterContent.slice(startIndex, endIndex);
                          const extractedText = match[1];
                          const similarityPercentage = calculateSimilarityPercentage(extractedText, link.secondEndPoint.selectedText);
                          console.log(startIndex,endIndex,extractedText,similarityPercentage)

                          if (similarityPercentage > 50 ) {
                            link.secondEndPoint.selectedText = extractedText;
                            link.secondEndPoint.lineContent = afterContent
                            new Notice('Link reparing!')
                          } 
                          else
                          {new Notice('The changes made on link was too much so the link will break')}
                        
                        }
                      }
                      
                      }
                      
                    }
                    else if(link.secondEndPoint.lineContent === afterContent  && link.secondEndPoint.noteName === modifiedNoteName){
                      link.secondEndPoint.lineNumber = lineNumber.toString();
                    }
                    
                  });
                  web.externalLinks.forEach(externalLink => {
                    if(parseInt(externalLink.sourceText.lineNumber) === lineNumber && externalLink.sourceText.noteName === modifiedNoteName)
                    {
                      
                      if(externalLink.sourceText.lineContent === beforeContent)
                      {
                        if(afterContent.includes(externalLink.sourceText.prefixText + externalLink.sourceText.selectedText + externalLink.sourceText.suffixText)){
                          console.log("externalLink content Ok! Just update the new Content");
                          externalLink.sourceText.lineContent = afterContent
                        } else{
                          const pattern = new RegExp(`${externalLink.sourceText.prefixText}(.*)${externalLink.sourceText.suffixText}`);
                        if(afterContent.includes(externalLink.sourceText.prefixText + externalLink.sourceText.selectedText))
                        {
                          //suffix changed
                          let col = afterContent.indexOf(externalLink.sourceText.prefixText + externalLink.sourceText.selectedText);
                          col = col+(externalLink.sourceText.prefixText + externalLink.sourceText.selectedText).length
                          
                          const suffixLine = afterContent.substring(col);
                          const wordsAfterSelection = suffixLine.split(" ");
                          externalLink.sourceText.suffixText = wordsAfterSelection.slice(0,5).join(" ");
                          externalLink.sourceText.lineContent = afterContent
                          console.log("Suffix updated, Line and content in note updated")
                          
                        }
                        else if(afterContent.includes(externalLink.sourceText.selectedText+ externalLink.sourceText.suffixText))
                        {
                          // prefix changed
                          let col= afterContent.indexOf(externalLink.sourceText.selectedText+ externalLink.sourceText.suffixText);
                          const prefixLine = afterContent.substring(0, col);
                          const wordsBeforeSelection = prefixLine.split(" ");
                          externalLink.sourceText.prefixText = wordsBeforeSelection.slice(-5).join(" ");
                          externalLink.sourceText.lineContent = afterContent
                          console.log("Prefix updated, Line and content in note updated")
                        }
                        else if(afterContent.match(pattern)){
                          const match = afterContent.match(pattern) 
                          const extractedText = match[1];
                          const similarityPercentage = calculateSimilarityPercentage(extractedText, externalLink.sourceText.selectedText);
                          if (similarityPercentage > 50 ) {
                            externalLink.sourceText.selectedText = extractedText;
                            externalLink.sourceText.lineContent = afterContent
                            new Notice('Link reparing!')
                          } else{new Notice('The changes made on link was too much so the link will break');}
                        
                        }
                        
                      }
                      
                      }
                      
                    }
                    else if(externalLink.sourceText.lineContent === afterContent && externalLink.sourceText.noteName === modifiedNoteName){
                      externalLink.sourceText.lineNumber = lineNumber.toString();
                    }
                  });
                  web.linksToPdfPage.forEach(pdfLink => {
                    if(parseInt(pdfLink.sourceText.lineNumber) === lineNumber && pdfLink.sourceText.noteName === modifiedNoteName)
                    {
                      
                      if(pdfLink.sourceText.lineContent === beforeContent)
                      {
                        if(afterContent.includes(pdfLink.sourceText.prefixText + pdfLink.sourceText.selectedText + pdfLink.sourceText.suffixText)){
                          console.log("externalLink content Ok! Just update the new Content");
                          pdfLink.sourceText.lineContent = afterContent
                        } else{
                          const pattern = new RegExp(`${pdfLink.sourceText.prefixText}(.*)${pdfLink.sourceText.suffixText}`);
                        if(afterContent.includes(pdfLink.sourceText.prefixText + pdfLink.sourceText.selectedText))
                        {
                          //suffix changed
                          let col = afterContent.indexOf(pdfLink.sourceText.prefixText + pdfLink.sourceText.selectedText);
                          col = col+(pdfLink.sourceText.prefixText + pdfLink.sourceText.selectedText).length
                          
                          const suffixLine = afterContent.substring(col);
                          const wordsAfterSelection = suffixLine.split(" ");
                          pdfLink.sourceText.suffixText = wordsAfterSelection.slice(0,5).join(" ");
                          pdfLink.sourceText.lineContent = afterContent
                          console.log("Suffix updated, Line and content in note updated")
                          
                        }
                        else if(afterContent.includes(pdfLink.sourceText.selectedText+ pdfLink.sourceText.suffixText))
                        {
                          // prefix changed
                          let col= afterContent.indexOf(pdfLink.sourceText.selectedText+ pdfLink.sourceText.suffixText);
                          const prefixLine = afterContent.substring(0, col);
                          const wordsBeforeSelection = prefixLine.split(" ");
                          pdfLink.sourceText.prefixText = wordsBeforeSelection.slice(-5).join(" ");
                          pdfLink.sourceText.lineContent = afterContent
                          console.log("Prefix updated, Line and content in note updated")
                        }
                        else if(afterContent.match(pattern)){
                          const match = afterContent.match(pattern) 
                          const extractedText = match[1];
                          const similarityPercentage = calculateSimilarityPercentage(extractedText, pdfLink.sourceText.selectedText);
                          if (similarityPercentage > 50 ) {
                            pdfLink.sourceText.selectedText = extractedText;
                            pdfLink.sourceText.lineContent = afterContent
                            new Notice('Link reparing!')
                          } else{new Notice('The changes made on link was too much so the link will break');}
                        
                        }

                        
                      }
                      
                      }
                      
                    }
                    else if(pdfLink.sourceText.lineContent === afterContent && pdfLink.sourceText.noteName === modifiedNoteName){
                      pdfLink.sourceText.lineNumber = lineNumber.toString();
                    }
                  });
                  web.linksToHeading.forEach(headingLink => {
                    if(parseInt(headingLink.sourceText.lineNumber) === lineNumber&& headingLink.sourceText.noteName === modifiedNoteName)
                    {
                      
                      if(headingLink.sourceText.lineContent === beforeContent)
                      {
                        if(afterContent.includes(headingLink.sourceText.prefixText + headingLink.sourceText.selectedText + headingLink.sourceText.suffixText)){
                          console.log("headingLink content Ok! Just update the new Content");
                          headingLink.sourceText.lineContent = afterContent
                        } else{
                          const pattern = new RegExp(`${headingLink.sourceText.prefixText}(.*)${headingLink.sourceText.suffixText}`);
                        if(afterContent.includes(headingLink.sourceText.prefixText + headingLink.sourceText.selectedText))
                        {
                          //suffix changed
                          let col = afterContent.indexOf(headingLink.sourceText.prefixText + headingLink.sourceText.selectedText);
                          col = col+(headingLink.sourceText.prefixText + headingLink.sourceText.selectedText).length
                          
                          const suffixLine = afterContent.substring(col);
                          const wordsAfterSelection = suffixLine.split(" ");
                          headingLink.sourceText.suffixText = wordsAfterSelection.slice(0,5).join(" ");
                          headingLink.sourceText.lineContent = afterContent
                          console.log("Suffix updated, Line and content in note updated")
                          
                        }
                        else if(afterContent.includes(headingLink.sourceText.selectedText+ headingLink.sourceText.suffixText))
                        {
                          // prefix changed
                          let col= afterContent.indexOf(headingLink.sourceText.selectedText+ headingLink.sourceText.suffixText);
                          const prefixLine = afterContent.substring(0, col);
                          const wordsBeforeSelection = prefixLine.split(" ");
                          headingLink.sourceText.prefixText = wordsBeforeSelection.slice(-5).join(" ");
                          headingLink.sourceText.lineContent = afterContent
                          console.log("Prefix updated, Line and content in note updated")
                        }
                        else if(afterContent.match(pattern)){
                          const match = afterContent.match(pattern) 
                          const extractedText = match[1];
                          const similarityPercentage = calculateSimilarityPercentage(extractedText, headingLink.sourceText.selectedText);
                          if (similarityPercentage > 50 ) {
                            headingLink.sourceText.selectedText = extractedText;
                            headingLink.sourceText.lineContent = afterContent
                            new Notice('Link reparing!')
                          } else{new Notice('The changes made on link was too much so the link will break');}
                        
                        }

                        
                      }
                      
                      }
                      
                    }
                    else if(headingLink.sourceText.lineContent === afterContent && headingLink.sourceText.noteName === modifiedNoteName){
                      headingLink.sourceText.lineNumber = lineNumber.toString();
                    }
                    
                  });
                  
                  //
                }
              }
            

            // Update the previous content with the new content
            //previousContent = content;
            // web.notes[index].noteContent = previousContent;
    
            web.notes[index].noteContent = content;
            const jsonContent = JSON.stringify(web);
            this.refreshViews();
            await this.app.vault.adapter.write(linkFilePath, jsonContent);
            
            
            }
          } 
        }
    };
    async refreshViews(){
      const leaves = this.app.workspace.getLeavesOfType("markdown");
                    for( const leaf of leaves)
                    {
                      if(leaf.getViewState().state?.mode === 'preview')
                      {
                        //@ts-ignore
                        leaf.rebuildView();
                      }
                    }
    }
    
    
    // handling when the documents renamed 
    async updateJsonRenamedFiles(oldTitle: string, newTitle: string) {
        const folderName = 'Webs Folder';
        let filesPath =[];
        const folder = this.app.vault.getAbstractFileByPath(folderName);
          if (folder instanceof TFolder) {
            folder.children.forEach((child)=>{
              filesPath.push(child.path);
            })
          }

        for(let i =0; i<filesPath.length;i++)
        {
        //const linkFilePath = this.settings.currentWeb;
        let linkFilePath = filesPath[i]
        
        const content = await this.app.vault.adapter.read(linkFilePath);
        const web = JSON.parse(content);
        // Search for old titles in the JSON and update them with the new titles
        web.bidirectionalLinks.forEach((link) => {
        if (link.firstEndPoint.noteName === oldTitle) {
            link.firstEndPoint.noteName = newTitle;
        } else if(link.secondEndPoint.noteName === oldTitle){
            link.secondEndPoint.noteName = newTitle;
        } else console.log("No changes in inline links names")
        });
        web.externalLinks.forEach((externalLink) => {
          if (externalLink.sourceText.noteName === oldTitle) {
            externalLink.sourceText.noteName = newTitle;
          } else console.log("No changes in external link note names")
          });
          web.linksToPdfPage.forEach((link) => {
            if (link.sourceText.noteName === oldTitle) {
              link.sourceText.noteName = newTitle;
            } else console.log("No changes in pdf link note names")
            });
          web.linksToHeading.forEach((headinLink) => {
            if (headinLink.sourceText.noteName === oldTitle) {
              headinLink.sourceText.noteName = newTitle;
            } else if(headinLink.headingNoteName === oldTitle){
              headinLink.headingNoteName = newTitle;
            } else console.log("No changes in heading links names")
          });
          web.notes.forEach((note) => {
            if (note.noteName === oldTitle) {
              note.noteName = newTitle;
              console.log("name changed")
            } else console.log("No changes in notes names")
            });
    
        const updatedContent = JSON.stringify(web);
        await this.app.vault.adapter.write(linkFilePath, updatedContent);
          }
    }
    handleFileRename = async (file: TFile, oldPath: string) => {
        
        if (file.extension === 'md') {
        const oldTitle = this.getOldNoteTitle(oldPath);
        const newTitle = this.getNoteTitleFromPath(file.path);    
        console.log(`Note title changed: ${oldTitle} -> ${newTitle}`);
        this.oldTitles.set(oldTitle, newTitle);
        await this.updateJsonRenamedFiles(oldTitle, newTitle);

        }
    }
    getOldNoteTitle(path: string):string{
        const oldTitle = this.oldTitles.get(path);
        return oldTitle ? oldTitle : this.getNoteTitleFromPath(path);
    }
    getNoteTitleFromPath(path: string): string {
        const fileName = path.split('/').pop() || '';
        return fileName.slice(0, -3); 
    }
    
    // 
    getOccurencess = (content: string, selection: string): any => {
      //const regex = new RegExp(`\\b${escapeRegExpw(selection)}\\b`, 'g');
      const regex = new RegExp(`(?:\\b|\\W)${escapeReg(selection)}(?:\\b|\\W)`, 'g');
      const occurrences = [];
      let match;
      while ((match = regex.exec(content))) {
        const start = match.index;
        const end = match.index + selection.length;
        occurrences.push({ "start": start, "end": end, "index": match.index,"match":match });
      
      }
      return occurrences;
    };
    setPrefix_Suffix = async(editor:Editor,selection: string) =>{
      let prefix = '';
      let suffix = '';
      let lineContent = '';
      let lineNumber = '';
      const boundaries = editor.listSelections();
      const content = editor.getValue();
      // boundaries return the anchor where the coursur was when the user start the selection and head where the selection is finished.
      if (boundaries && selection) {
        let line1 = -1;
        let col1 = -1;
        let line2 = -1;
        let col2 = -1;
        if (boundaries[0].head.line < boundaries[0].anchor.line) {
          line1 = boundaries[0].head.line;
          col1 = boundaries[0].head.ch;
          line2 = boundaries[0].anchor.line;
          col2 = boundaries[0].anchor.ch;

        } else if (boundaries[0].head.line > boundaries[0].anchor.line) {
          line1 = boundaries[0].anchor.line;
          col1 = boundaries[0].anchor.ch;
          line2 = boundaries[0].head.line;
          col2 = boundaries[0].head.ch;

        } else { //line1 == line2
          if (boundaries[0].head.ch < boundaries[0].anchor.ch) {
            line1 = boundaries[0].head.line;
            col1 = boundaries[0].head.ch;
            line2 = boundaries[0].anchor.line;
            col2 = boundaries[0].anchor.ch;
            
          } else if (boundaries[0].head.ch > boundaries[0].anchor.ch) {
            line1 = boundaries[0].anchor.line;
            col1 = boundaries[0].anchor.ch;
            line2 = boundaries[0].head.line;
            col2 = boundaries[0].head.ch;
           
          }
        }
        
        
        const prefixLine = editor.getLine(line1).substring(0, col1);
        const wordsBeforeSelection = prefixLine.split(" ");
        const suffixLine = editor.getLine(line2).substring(col2);
        const wordsAfterSelection = suffixLine.split(" ");
        
        let wordsCount = 5;
        prefix = wordsBeforeSelection.slice(-wordsCount).join(" ");
        suffix = wordsAfterSelection.slice(0,wordsCount).join(" ");
        
        
        while(this.getOccurencess(content, (prefix+selection+suffix)).length > 1)
        {
          wordsCount +=1
          prefix = wordsBeforeSelection.slice(-wordsCount).join(" ");
          suffix = wordsAfterSelection.slice(0,wordsCount).join(" ");
          
        }
        let currentNoteName =this.app.workspace.getActiveFile()?.basename;
        this.saveNotesToWeb(content,currentNoteName);
        
        lineContent = editor.getLine(line1);
        line1 = line1+1
        lineNumber = line1.toString();
        
        
      }
      return [prefix, suffix,lineNumber,lineContent]
    };
    saveNotesToWeb = async (content:string,currentNoteName:any): Promise<void> =>{
      
      const linkFilePath = this.settings.currentWeb;
      let webContent = await this.app.vault.adapter.read(linkFilePath);
      let web = JSON.parse(webContent);
      let noteNameFound = false;
      
      for(let i = 0; i < web.notes.length;i++)
      {
        if(web.notes[i].noteName === currentNoteName)
        {
          noteNameFound = true;
          break;
        }
        
      }
      if (noteNameFound == false)
      { web.notes.push({"noteName":currentNoteName,"noteContent":content})}

      const jsonContent = JSON.stringify(web);
      await this.app.vault.adapter.write(this.settings.currentWeb, jsonContent);
    }
    
    selectFirstEndpoint = async (editor: Editor) => {
      if(this.settings.currentWeb === '' ){
        new Notice("Please create a web or select one before start linking");
        return
      }
      const selection = editor.getSelection();
      if (!isSingleLineSelection(editor,selection)) {
        new InvalidSelectionModal(this.app).open();
        return;
      }
      
      const [prefix, suffix,lineNumber,lineContent]= await this.setPrefix_Suffix(editor,selection);
      //@ts-ignore
      this.temporaryendPoint.noteName = this.app.workspace.getActiveFile()?.basename;
      this.temporaryendPoint.selectedText = selection;
      this.temporaryendPoint.prefixText = prefix;
      this.temporaryendPoint.suffixText = suffix;
      this.temporaryendPoint.lineNumber = lineNumber;
      this.temporaryendPoint.lineContent = lineContent;
      //
      this.temporaryLink.firstEndPoint = this.temporaryendPoint;
      this.temporaryendPoint = {selectedText: '', noteName: '', prefixText:'',suffixText: '',lineContent:'',lineNumber:''};
      new Notice("Link process started")
    };
    selectSecondEndpoint = async(editor: Editor) => {
      if(this.settings.currentWeb === '' ){
        new Notice("Please create a web or select one before start linking")
        return
      }
      const selection = editor.getSelection();
      if (!isSingleLineSelection(editor,selection)) {
        new InvalidSelectionModal(this.app).open();
        return;
      }
      

      const [prefix, suffix,lineNumber,lineContent]= await this.setPrefix_Suffix(editor,selection);

      //@ts-ignore
      this.temporaryendPoint.noteName = this.app.workspace.getActiveFile()?.basename;
      this.temporaryendPoint.selectedText = selection;
      this.temporaryendPoint.prefixText = prefix;
      this.temporaryendPoint.suffixText = suffix;
      this.temporaryendPoint.lineNumber = lineNumber;
      this.temporaryendPoint.lineContent = lineContent;
      //
      this.temporaryLink.secondEndPoint = this.temporaryendPoint;
      this.temporaryendPoint = {selectedText: '', noteName: '', prefixText:'',suffixText: '',lineContent:'',lineNumber:''};
      
      // Prompt the user to enter additional text
      const modal = new Modal(this.app);
      const contentEl = modal.contentEl;
      const linkName = createEl('input', { attr: { type: 'text', placeholder:'Enter link name' } });
      const linkKeyWord = createEl('input', { attr: { type: 'text', placeholder:'Enter link keyword' } });
      const createButton = createEl('button', { text: 'Create Link' });
      contentEl.createEl('p', { text: 'Please enter a specific name for the link (This aid in link management):' });
      contentEl.appendChild(linkName);
      contentEl.createEl('p', { text: 'Enter a keyword for the link:' });
      contentEl.appendChild(linkKeyWord);
      contentEl.appendChild(createButton);
      createButton.addClass('mod-cta');
      const closeModal = () => {
        this.temporaryLink.linkKeyWord = linkKeyWord.value;
        this.temporaryLink.linkName = linkName.value;
        this.temporaryLink.creationTime = new Date().toLocaleString();
        this.temporaryLink.enableFeature = true;
        this.saveBidirectionalLinkObject();
        modal.close();
        new Notice("Link process Completed")
      };

      createButton.addEventListener('click', closeModal);
      modal.open();
    
    };
    createLinkTOExternalRecource = async(editor: Editor) => {
      if(this.settings.currentWeb === '' ){
        new Notice("Please create a web or select one before start linking")
        return
      }
        const selection = editor.getSelection()?.toString();
        if (!isSingleLineSelection(editor,selection)) {
          new InvalidSelectionModal(this.app).open();
          return;
        }
        const [prefix, suffix,lineNumber,lineContent]= await this.setPrefix_Suffix(editor,selection);
        const modal = new Modal(this.app);
        const contentEl = modal.contentEl;
        let recourceFinalPath = '';
        // URL input field
        contentEl.createEl('p', { text: 'Please enter URL or choose a local file:' });
        const linkInput = createEl('input', { attr: { type: 'text',placeholder: 'https://example.com' } });
        contentEl.appendChild(linkInput);
        const importButton = createEl('button', { text: 'Choose file' });
        importButton?.addClass('mod-cta');
        contentEl.appendChild(importButton);
        // Create an input element of type "file"
        const fileInput = createEl('input', { attr: { type: 'file' } });
        const targetTextField = createEl('input', { attr: { type: 'text', placeholder: 'Selected File Path' } });
        
        targetTextField.style.cursor = 'not-allowed';
        targetTextField.disabled = true;
        fileInput.style.display = 'none';
        fileInput.addEventListener('change', () => {
          //@ts-ignore
          const selectedFile = fileInput.files[0];
          //const selectedFilePath = selectedFile ? selectedFile.path : '';
          //@ts-ignore
          const selectedFilePath = selectedFile.path;
          recourceFinalPath = "file:///"+selectedFilePath
          targetTextField.value = recourceFinalPath;
        });

        importButton.addEventListener('click', async () => {

              fileInput.click();
          
            });
        contentEl.appendChild(targetTextField);

        const linkNamefield = createEl('input', { attr: { type: 'text',placeholder:'Enter link name' } });
        const linkKeyWord = createEl('input', { attr: { type: 'text',placeholder:'Enter keyword' } });
        const createButton = createEl('button', { text: 'Create Link' });
        createButton?.addClass('mod-cta');
        contentEl.createEl('p', { text: 'Please enter a specific name for the link (This aid in link management):' });
        contentEl.appendChild(linkNamefield);
        contentEl.createEl('p', { text: 'Enter a keyword for the link:' });
        contentEl.appendChild(linkKeyWord);
        contentEl.appendChild(createButton);
        createButton.addEventListener('click', () => {
          const linkURL = linkInput.value;
          const linkName = linkNamefield.value;
          const linkKeyword = linkKeyWord.value;
          if (linkURL && linkName) {
            // Check if the URL is valid
            const urlPattern = /^(https?:\/\/)?([\w.-]+)\.([a-z]{2,})(\/.*)?$/i;
            if (urlPattern.test(linkURL)) {
            // URL is valid, perform the desired action
            //@ts-ignore
            this.temporaryendPoint.noteName = this.app.workspace.getActiveFile()?.basename;
            this.temporaryendPoint.selectedText = selection;
            this.temporaryendPoint.prefixText = prefix;
            this.temporaryendPoint.suffixText = suffix;
            this.temporaryendPoint.lineNumber = lineNumber;
            this.temporaryendPoint.lineContent = lineContent;

            this.temporaryLinkExternal.sourceText = this.temporaryendPoint;
            this.temporaryLinkExternal.URL = linkURL;
            this.temporaryLinkExternal.creationTime = new Date().toLocaleString();
            this.temporaryLinkExternal.linkName = linkName;
            this.temporaryLinkExternal.linkKeyWord = linkKeyword;
            this.temporaryendPoint = {selectedText: '', noteName: '', prefixText:'',suffixText: '',lineContent:'',lineNumber:''};
            this.saveExternalLinkObject();
            } else {
              // Invalid URL, display an error message to the user
              new Notice('Please enter a vaild URL')
            }
          } else if (recourceFinalPath != '' && linkName) {
            //@ts-ignore
            this.temporaryendPoint.noteName = this.app.workspace.getActiveFile()?.basename;
            this.temporaryendPoint.selectedText = selection;
            this.temporaryendPoint.prefixText = prefix;
            this.temporaryendPoint.suffixText = suffix;
            this.temporaryendPoint.lineNumber = lineNumber;
            this.temporaryendPoint.lineContent = lineContent;

            this.temporaryLinkExternal.sourceText = this.temporaryendPoint;
            this.temporaryLinkExternal.URL = recourceFinalPath;
            this.temporaryLinkExternal.creationTime = new Date().toLocaleString();
            this.temporaryLinkExternal.linkName = linkName;
            this.temporaryLinkExternal.linkKeyWord = linkKeyword;
            this.temporaryendPoint = {selectedText: '', noteName: '', prefixText:'',suffixText: '',lineContent:'',lineNumber:''};
            this.saveExternalLinkObject();
            
          } else {
            new Notice('Please provide a URL or chose a file and provide an explanation');
          }
          
        
        modal.close();
      });

      modal.open();
    };
    createLinkToHeading = async(editor: Editor) => {
      if(this.settings.currentWeb === '' ){
        new Notice("Please create a web or select one before start linking")
        return
      }
      const selection = editor.getSelection()?.toString();
      if (!isSingleLineSelection(editor,selection)) {
        new InvalidSelectionModal(this.app).open();
        return;
      }

      const [prefix, suffix, lineNumber,lineContent]= await this.setPrefix_Suffix(editor,selection);
      const modal = new Modal(this.app);
      const contentEl = modal.contentEl;
      const mdFiles = app.vault.getMarkdownFiles();
      let noteName: string;
      contentEl.createEl('p', { text: 'Please Select the target note name:' });
      const dropdown = createEl('select');
      
      const defaultOption = createEl('option');
        defaultOption.value = '';
        defaultOption.text = 'Select a note';
        defaultOption.selected = true;
        dropdown.appendChild(defaultOption);
            mdFiles.forEach((file) => {
            const option = createEl('option');
            option.value = file.path;
            option.text = file.name;
            dropdown.appendChild(option);
            });  
        contentEl.appendChild(dropdown);
        contentEl.createEl('p', { text: 'Please choose the heading name to establish the link:' })
        const headingDropdown = createEl('select');
        const HeadingDefaultOption = createEl('option');
        HeadingDefaultOption.value = '';
        HeadingDefaultOption.text = 'Select a Heading';
        HeadingDefaultOption.selected = true;
        
        headingDropdown.appendChild(HeadingDefaultOption);
        headingDropdown.classList.add('custom-dropdown');
        contentEl.appendChild(headingDropdown);
        const linkNamefield = createEl('input', { attr: { type: 'text', placeholder:'Enter link name' } });
        contentEl.createEl('p', { text: 'Please enter a specific name for the link (This aid in link management):' });
        contentEl.appendChild(linkNamefield);
        const linkKeyWordfield = createEl('input', { attr: { type: 'text', placeholder:'Enter keyword' } });
        contentEl.createEl('p', { text: 'Enter a keyword for the link:' });
        contentEl.appendChild(linkKeyWordfield);
        const createButton = createEl('button', { text: 'Create Link' });
        createButton?.addClass('mod-cta');
        contentEl.appendChild(createButton);
        dropdown.addEventListener('change', async () => {
          const selectedNotePath = dropdown.value;
          const selectedNote = this.app.vault.getAbstractFileByPath(selectedNotePath) as TFile;
          const noteContent = await this.app.vault.read(selectedNote);
          noteName = basename(selectedNote.name, '.md'); // Extract the note name without the extension
          const headingNames = getHeadingNames(noteContent);
          headingDropdown.innerHTML = ''; // Clear previous options
          //
            // Get all files in the vault
            const file =  this.app.vault.getAbstractFileByPath(selectedNote.name);
            if (file instanceof TFile) {
              // Read the content of the note
            const contentHeadingNote = await this.app.vault.read(file);
            this.saveNotesToWeb(contentHeadingNote,noteName);
            }
          //
          // Populate the heading dropdown with the heading names
          headingNames.forEach((headingName) => {
            const option = createEl('option');
            option.value = headingName;
            option.text = headingName;
            headingDropdown.appendChild(option);
          });
          });
        
          createButton.addEventListener('click', () => {
            const selectedHeadingNoteName = noteName;
            const headingName = headingDropdown.value;
            const linkName = linkNamefield.value;
            const linkKeyWord = linkKeyWordfield.value;
            
          if (selectedHeadingNoteName && headingName && linkName && linkKeyWord) {
            //@ts-ignore
            this.temporaryendPoint.noteName = this.app.workspace.getActiveFile()?.basename;
            this.temporaryendPoint.selectedText = selection;
            this.temporaryendPoint.prefixText = prefix;
            this.temporaryendPoint.suffixText = suffix;
            this.temporaryendPoint.lineNumber = lineNumber;
            this.temporaryendPoint.lineContent = lineContent;

            this.temporaryLinkToHeading.sourceText = this.temporaryendPoint;
            this.temporaryLinkToHeading.headingName = headingName;
            this.temporaryLinkToHeading.headingNoteName = selectedHeadingNoteName;
            this.temporaryLinkToHeading.creationTime = new Date().toLocaleString();
            this.temporaryLinkToHeading.linkName = linkName;
            this.temporaryLinkToHeading.linkKeyWord = linkKeyWord;
            this.temporaryendPoint = {selectedText: '', noteName: '', prefixText:'',suffixText: '',lineContent:'',lineNumber:''};
            
            this.saveHeadingLinkObject();
          }
          modal.close();
        });

        modal.open();
    
    };
    createLinkToPDFPage = async(editor: Editor) => {
      if(this.settings.currentWeb === '' ){
        new Notice("Please create a web or select one before start linking")
        return
      }
      const selection = editor.getSelection()?.toString();
      if (!isSingleLineSelection(editor,selection)) {
        new InvalidSelectionModal(this.app).open();
        return;
      }

      const [prefix, suffix, lineNumber,lineContent]= await this.setPrefix_Suffix(editor,selection);
      const modal = new Modal(this.app);
      const contentEl = modal.contentEl;
      const Files = app.vault.getFiles()
      let pdfFiles = [] as any;
      Files.forEach(file => {
        if(file.path.slice(-3) == "pdf")
          pdfFiles.push(file)
      });
      let noteName: string;
      contentEl.createEl('p', { text: 'Please Select the target pdf:' });
      const dropdown = createEl('select');
        // Create an empty option for the default selection
      const defaultOption = createEl('option');
        defaultOption.value = '';
        defaultOption.text = 'Select a pdf';
        defaultOption.selected = true;
        dropdown.appendChild(defaultOption);
            pdfFiles.forEach((file) => {
            const option = createEl('option');
            option.value = file.path;
            option.text = file.name;
            dropdown.appendChild(option);
            });  
        contentEl.appendChild(dropdown);
        contentEl.createEl('p', { text: 'Please enter the target page:' })
        const targetPage = createEl('input', { attr: { type: 'text', placeholder:'Enter page number' } });
        contentEl.appendChild(targetPage);
        const linkNamefield = createEl('input', { attr: { type: 'text', placeholder:'Enter link name' } });
        contentEl.createEl('p', { text: 'Please enter a specific name for the link (This aid in link management):' });
        contentEl.appendChild(linkNamefield);
        const linkKeyWordfield = createEl('input', { attr: { type: 'text', placeholder:'Enter keyword' } });
        contentEl.createEl('p', { text: 'Enter a keyword for the link:' });
        contentEl.appendChild(linkKeyWordfield);
        const createButton = createEl('button', { text: 'Create Link' });
        createButton?.addClass('mod-cta');
        contentEl.appendChild(createButton);
        dropdown.addEventListener('change', async () => {
          const selectedNotePath = dropdown.value;
          const selectedNote = this.app.vault.getAbstractFileByPath(selectedNotePath) as TFile;
          noteName = basename(selectedNote.name, '.pdf'); // Extract the note name without the extensio
        });
          createButton.addEventListener('click', () => {
            const pdfFileName = noteName;
            const targetPdfPage = targetPage.value;
            const linkName = linkNamefield.value;
            const linkKeyWord = linkKeyWordfield.value;
            
          if (pdfFileName && targetPdfPage && linkName ) {
            //@ts-ignore
            this.temporaryendPoint.noteName = this.app.workspace.getActiveFile()?.basename;
            this.temporaryendPoint.selectedText = selection;
            this.temporaryendPoint.prefixText = prefix;
            this.temporaryendPoint.suffixText = suffix;
            this.temporaryendPoint.lineNumber = lineNumber;
            this.temporaryendPoint.lineContent = lineContent;

            this.temporaryLinkToPdfPage.sourceText = this.temporaryendPoint;
            this.temporaryLinkToPdfPage.targetPage = targetPdfPage;
            this.temporaryLinkToPdfPage.pdfNoteName = pdfFileName;
            this.temporaryLinkToPdfPage.creationTime = new Date().toLocaleString();
            this.temporaryLinkToPdfPage.linkName = linkName;
            this.temporaryLinkToPdfPage.linkKeyWord = linkKeyWord;
            this.temporaryendPoint = {selectedText: '', noteName: '', prefixText:'',suffixText: '',lineContent:'',lineNumber:''};
            
            this.savepdfLinkObject();
          }
          modal.close();
        });

        modal.open();
    
    }
    
    saveBidirectionalLinkObject = async () => {
      if(this.settings.currentWeb ==='') return // if web Disabled=> do nothing
      let currentWeb = await this.app.vault.adapter.read(this.settings.currentWeb);
      const webContent = JSON.parse(currentWeb);
      webContent.bidirectionalLinks.push(this.temporaryLink);
      try {
        const jsonContent = JSON.stringify(webContent);
        await this.app.vault.adapter.write(this.settings.currentWeb, jsonContent);
        this.temporaryLink = {
          iD:uuidv4(),
          firstEndPoint: this.temporaryendPoint,
          secondEndPoint: this.temporaryendPoint,
          creationTime: '',
          linkName: '',
          enableFeature:true,
          linkKeyWord:''

        };
        new Notice('Link objects saved successfully!');
      } catch (error) {
        console.error('Error saving link objects:', error);
        new Notice('Error saving link objects. Please check the console for more details.');
      }
    };
    
    saveExternalLinkObject = async () => {
      
      if(this.settings.currentWeb ==='') return // if web Disabled=> do nothing
      let currentWeb = await this.app.vault.adapter.read(this.settings.currentWeb);
      const webContent = JSON.parse(currentWeb);
      webContent.externalLinks.push(this.temporaryLinkExternal);
      try {
        const jsonContent = JSON.stringify(webContent);
        await this.app.vault.adapter.write(this.settings.currentWeb, jsonContent);
        this.temporaryLinkExternal = {
          iD:uuidv4(),
          sourceText: this.temporaryendPoint,
          URL: '',
          creationTime: '',
          linkName: '',
          enableFeature:true,
          linkKeyWord:''

        };

        new Notice('Link objects saved successfully!');
      } catch (error) {
        console.error('Error saving link objects:', error);
        new Notice('Error saving link objects. Please check the console for more details.');
      }
    };
    
    saveHeadingLinkObject = async () => {
      if(this.settings.currentWeb ==='') return // if web Disabled=> do nothing
      
      let currentWeb = await this.app.vault.adapter.read(this.settings.currentWeb);
      const webContent = JSON.parse(currentWeb);
      webContent.linksToHeading.push(this.temporaryLinkToHeading);
      try {
        const jsonContent = JSON.stringify(webContent);
        await this.app.vault.adapter.write(this.settings.currentWeb, jsonContent);
        this.temporaryLinkToHeading = {
          iD:uuidv4(),
          sourceText: this.temporaryendPoint,
          headingName: '',
          headingNoteName: '',
          creationTime: '',
          linkName: '',
          enableFeature:true,
          linkKeyWord:''

        };

        new Notice('Link objects saved successfully!');
      } catch (error) {
        console.error('Error saving link objects:', error);
        new Notice('Error saving link objects. Please check the console for more details.');
      }
    };
    savepdfLinkObject = async () => {
      if(this.settings.currentWeb ==='') return // if web Disabled=> do nothing
      
      let currentWeb = await this.app.vault.adapter.read(this.settings.currentWeb);
      const webContent = JSON.parse(currentWeb);
      webContent.linksToPdfPage.push(this.temporaryLinkToPdfPage);
      try {
        const jsonContent = JSON.stringify(webContent);
        await this.app.vault.adapter.write(this.settings.currentWeb, jsonContent);
        this.temporaryLinkToPdfPage = {
          iD:uuidv4(),
          sourceText: this.temporaryendPoint,
          targetPage: '',
          pdfNoteName: '',
          creationTime: '',
          linkName: '',
          enableFeature:true,
          linkKeyWord:''

        };

        new Notice('Link objects saved successfully!');
      } catch (error) {
        console.error('Error saving link objects:', error);
        new Notice('Error saving link objects. Please check the console for more details.');
      }
    };
    // links rendering
    postProcessor = async () => {
      this.registerMarkdownPostProcessor(async (element, ctx) => {
        if(this.settings.currentWeb ==='') return 
        const linkFilePath = this.settings.currentWeb;
        let content = await this.app.vault.adapter.read(linkFilePath);
        let web = JSON.parse(content);
        web.linksToPdfPage.forEach((pdflink) => {
          if(pdflink.enableFeature == true){
            const sourceNoteName = pdflink.sourceText.noteName;
            const selectedText = pdflink.sourceText.selectedText;
            const desTargetPage = pdflink.targetPage;
            const despdfFileName = pdflink.pdfNoteName;
            const id = pdflink.iD;
            const linkName = pdflink.linkName;
            const prefix = pdflink.sourceText.prefixText;
            const suffix = pdflink.sourceText.suffixText;
            const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
            
            if (activeView) {
              const activeFileBasename = activeView.file.basename;
              
              if(activeFileBasename === sourceNoteName && selectedText){
              const createLinkElement = (desTargetPage: string,despdfFileName:string, selectedText: string): HTMLAnchorElement => {
              const linkElement = document.createElement('a');
              linkElement.classList.add('external-link');
              linkElement.setAttribute('data-tooltip-position', 'top');
              linkElement.setAttribute('label', linkName)
              linkElement.setAttribute('aria-label', `Target: ${despdfFileName},Link name: ${linkName}`);
              linkElement.setAttribute('data-href', (despdfFileName +'#page='+desTargetPage));
              linkElement.setAttribute('href', (despdfFileName+'#'+ desTargetPage));
              linkElement.setAttribute('class', 'internal-link');
              linkElement.setAttribute('target', '_blank');
              linkElement.setAttribute('rel', 'noopener');
              linkElement.setAttribute('iD', id);
              linkElement.setAttribute('type','pdfLink')
              if(!this.settings.linkStyle) linkElement.classList.add("styled-link");
              linkElement.textContent = selectedText;
              return linkElement;
            };
            const linkElement = createLinkElement(desTargetPage,despdfFileName+'.pdf', selectedText);
            element.innerHTML = element.innerHTML.replace(prefix + selectedText + suffix, prefix + linkElement.outerHTML + suffix);
            
          } 

          }}
        });
        web.linksToHeading.forEach((linkHeading) => {
        if(linkHeading.enableFeature == true){
          
          const sourceNoteName = linkHeading.sourceText.noteName;
          const selectedText = linkHeading.sourceText.selectedText;
          const desHeading = linkHeading.headingName;
          const desHeadingNoteName = linkHeading.headingNoteName;
          const id = linkHeading.iD;
          const linkName = linkHeading.linkName;
          const prefix = linkHeading.sourceText.prefixText;
          const suffix = linkHeading.sourceText.suffixText;
          const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
          
          if (activeView) {
            const activeFileBasename = activeView.file.basename;
            
            if(activeFileBasename === sourceNoteName && selectedText){
            const createLinkElement = (desHeading: string,desHeadingNoteName:string, selectedText: string): HTMLAnchorElement => {
            const linkElement = document.createElement('a');
            linkElement.classList.add('external-link');
            linkElement.setAttribute('data-tooltip-position', 'top');
            linkElement.setAttribute('label', linkName)
            linkElement.setAttribute('aria-label', `Target: ${desHeadingNoteName},Link name: ${linkName}`);
            linkElement.setAttribute('data-href', (desHeadingNoteName+'#'+ desHeading));
            linkElement.setAttribute('href', (desHeadingNoteName+'#'+ desHeading));
            linkElement.setAttribute('class', 'internal-link');
            linkElement.setAttribute('target', '_blank');
            linkElement.setAttribute('rel', 'noopener');
            linkElement.setAttribute('id',id);
            linkElement.setAttribute('type','headingLink')
            if(!this.settings.linkStyle) linkElement.classList.add("styled-link");
            linkElement.textContent = selectedText;
            return linkElement;
          };
          
          const linkElement = createLinkElement(desHeading,desHeadingNoteName, selectedText);
          element.innerHTML = element.innerHTML.replace(prefix + selectedText + suffix, prefix + linkElement.outerHTML + suffix);
          
        } 

      }}
        });
        web.externalLinks.forEach((externalLink) => {
        if(externalLink.enableFeature == true){
        const sourceNoteName = externalLink.sourceText.noteName;
        const selectedText = externalLink.sourceText.selectedText;
        const desURL = externalLink.URL;
        const linkName = externalLink.linkName;
        const prefix = externalLink.sourceText.prefixText;
        const suffix = externalLink.sourceText.suffixText;
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        
        if (activeView) {
          const activeFileBasename = activeView.file.basename;
          
          if(activeFileBasename === sourceNoteName && selectedText){
          const createLinkElement = (desURL: string, selectedText: string): HTMLAnchorElement => {
          const linkElement = document.createElement('a');
          linkElement.classList.add('external-link');
          linkElement.setAttribute('data-tooltip-position', 'top');
          linkElement.setAttribute('aria-label', `Target: ${desURL},Link name: ${linkName}`);
          linkElement.setAttribute('data-href', desURL);
          linkElement.setAttribute('type','externalLink')
          linkElement.setAttribute('href', desURL);
          linkElement.setAttribute('class', 'external-link');
          linkElement.setAttribute('target', '_blank');
          linkElement.setAttribute('rel', 'noopener');
          if(!this.settings.linkStyle) linkElement.classList.add("styled-link");
          linkElement.textContent = selectedText;
          return linkElement;
        };
        
        
        const linkElement = createLinkElement(desURL, selectedText);
       
        element.innerHTML = element.innerHTML.replace(prefix + selectedText + suffix, prefix + linkElement.outerHTML + suffix);
        
          
          }
          }}
        });
    
        web.bidirectionalLinks.forEach((link) => {
        if(link.enableFeature == true){
        const iD = link.iD;
        const firstNoteName = link.firstEndPoint.noteName;
        const selectedText1 = link.firstEndPoint.selectedText;
        const prefix1 = link.firstEndPoint.prefixText;
        const suffix1 = link.firstEndPoint.suffixText;
        const secondNoteName = link.secondEndPoint.noteName;
        const selectedText2 = link.secondEndPoint.selectedText;
        const prefix2 = link.secondEndPoint.prefixText;
        const suffix2 = link.secondEndPoint.suffixText;
        const linkName = link.linkName;
        
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView) {
          const activeFileBasename = activeView.file.basename;
          if (activeFileBasename === firstNoteName && selectedText1) {
            const createLinkElement = (destName: string, selectedText: string): HTMLAnchorElement => {
              const linkElement = document.createElement('a');
              linkElement.setAttribute('data-tooltip-position', 'top'); // the lapel show the destionation note of the link 
              linkElement.setAttribute('aria-label', `Target: ${destName},Link name: ${linkName}`);
              linkElement.setAttribute('label', linkName)
              linkElement.setAttribute('data-href', destName);
              linkElement.setAttribute('href', destName);
              linkElement.setAttribute('id',iD+'1');
              linkElement.setAttribute('class', 'internal-link');
              linkElement.setAttribute('target', '_blank');
              linkElement.setAttribute('rel', 'noopener');
              linkElement.setAttribute('type','bidirectional')
              if(!this.settings.linkStyle) linkElement.classList.add("styled-link");
              
              linkElement.textContent = selectedText;
              
              return linkElement;
            };
            //
              // Check if the selected text is an image 
              const imageLinkRegex = /^!\[\[.*\]\]$/; 
              if (imageLinkRegex.test(selectedText1)) {
                const imageFileName = selectedText1.slice(3,-2);
                const imageElement = document.querySelector(`img[alt="${imageFileName}"]`) as HTMLImageElement;
                
                if(imageElement && imageElement.parentElement?.tagName.toLowerCase()!='a'){
                  
                  const linkElement = document.createElement('a');
                  linkElement.href = secondNoteName;
                  linkElement.setAttribute('data-href', secondNoteName);
                  linkElement.setAttribute('data-tooltip-position', 'top');
                  linkElement.setAttribute('class', 'internal-link');
                  linkElement.setAttribute('target', '_blank');
                  linkElement.setAttribute('rel', 'noopener');
                  linkElement.setAttribute('id',iD+'1');
                  linkElement.setAttribute('type','bidirectional')
                  imageElement.className = "linkImage"; 
                  linkElement.appendChild(imageElement.cloneNode(true));
                  imageElement.parentElement?.replaceChild(linkElement,imageElement);
                  
                }
                
              }
              
              // Check if the selected text is a video 
              //const videoLinkRegex = /^!\[\[.*\]\]$/;
              const videoLinkRegex = /^!\[\[.*\]\]$/; 
              if (videoLinkRegex.test(selectedText1)) {
                const videoFileName = selectedText1.slice(3, -2);
                const videoElement = document.querySelector(`span[alt="${videoFileName}"]`)?.firstChild as HTMLVideoElement;
                if (videoElement && videoElement.parentElement?.tagName.toLowerCase()!='a'&& videoElement.tagName.toLocaleLowerCase()!='a') {
                  if (!videoElement.parentElement?.classList.contains('linked-video')) {
                  const linkElement = document.createElement('a');
                  linkElement.href = secondNoteName;
                  linkElement.setAttribute('data-href', secondNoteName);
                  linkElement.setAttribute('data-tooltip-position', 'top');
                  linkElement.setAttribute('class', 'internal-link');
                  linkElement.setAttribute('target', '_blank');
                  linkElement.setAttribute('rel', 'noopener');
                  linkElement.setAttribute('id', iD + '1');
                  linkElement.setAttribute('type','bidirectional')
                  
                  linkElement.appendChild(videoElement.cloneNode(true));
                  // Store the current video style
                  const videoStyle = videoElement.getAttribute('style');
                  linkElement.addEventListener('Click', (event) => {
                    event.preventDefault();
                
                  });
                  // Add a class to the video element to indicate that the link has been added
                  videoElement.parentElement?.classList.add('linked-video');
                  videoElement.parentElement?.replaceChild(linkElement, videoElement);
                  // Set the stored video style to the new video element
                    const newVideoElement = linkElement.querySelector('video');
                    
                    if (newVideoElement && videoStyle) {
                      newVideoElement.setAttribute('style', '300px');
                      newVideoElement.className = 'linkVideo';
                    }
                    
                }
                }
              }
             
              const linkElement = createLinkElement(secondNoteName, selectedText1);
              element.innerHTML = element.innerHTML.replace(prefix1 + selectedText1 + suffix1, prefix1 + linkElement.outerHTML + suffix1);
              
              document.getElementById(iD+'1')?.onClickEvent((e)=>{
                  if(firstNoteName===secondNoteName){
                    e.preventDefault();
                    document.getElementById(iD+'2')?.scrollIntoView({behavior:'smooth'});
                  }
                  console.log("did assign id")
                  navigationTargetID = iD+'2';
                  }
              )
        
          }  if (activeFileBasename === secondNoteName && selectedText2) {
            
            const createLinkElement = (destName: string, selectedText: string): HTMLAnchorElement => {
              const linkElement = document.createElement('a');
              linkElement.setAttribute('data-tooltip-position', 'top');
              linkElement.setAttribute('aria-label', `Target: ${destName},Link name: ${linkName}`);
              linkElement.setAttribute('data-href', destName);
              linkElement.setAttribute('label', linkName)
              linkElement.setAttribute('href', destName);
              linkElement.setAttribute('id',iD+'2');
              linkElement.setAttribute('class', 'internal-link');
              linkElement.setAttribute('target', '_blank');
              linkElement.setAttribute('rel', 'noopener');
              linkElement.setAttribute('type','bidirectional')
              if(!this.settings.linkStyle) linkElement.classList.add("styled-link");
              linkElement.textContent = selectedText;
              
              return linkElement;
            };
            const imageLinkRegex = /^!\[\[.*\]\]$/;
            if (imageLinkRegex.test(selectedText2)) {
              const imageFileName = selectedText2.slice(3,-2);
              const imageElement = document.querySelector(`img[alt="${imageFileName}"]`);
              if(imageElement && imageElement.parentElement?.tagName.toLowerCase()!='a'){
                
                const linkElement = document.createElement('a');
                linkElement.href = firstNoteName;
                linkElement.setAttribute('data-href', firstNoteName);
                linkElement.setAttribute('data-tooltip-position', 'top');
                linkElement.setAttribute('class', 'internal-link');
                linkElement.setAttribute('target', '_blank');
                linkElement.setAttribute('rel', 'noopener');
                linkElement.setAttribute('id',iD+'2');
                linkElement.setAttribute('type','bidirectional')
                imageElement.className = "linkImage";
                linkElement.appendChild(imageElement.cloneNode(true));
                
               
                imageElement.parentElement?.replaceChild(linkElement,imageElement);
                
              }
            } 
            
            // Check if the selected text is a video
            
            const videoLinkRegex = /^!\[\[.*\]\]$/; 
            if (videoLinkRegex.test(selectedText2)) {
              const videoFileName = selectedText2.slice(3, -2);
              const videoElement = document.querySelector(`span[alt="${videoFileName}"]`)?.firstChild as HTMLVideoElement;
              
              if (videoElement && videoElement.parentElement?.tagName.toLowerCase()!='a'&& videoElement.tagName.toLocaleLowerCase()!='a') {
                if (!videoElement.parentElement?.classList.contains('linked-video')) {
                const linkElement = document.createElement('a');
                linkElement.href = firstNoteName;
                linkElement.setAttribute('data-href', firstNoteName);
                linkElement.setAttribute('data-tooltip-position', 'top');
                linkElement.setAttribute('class', 'internal-link');
                linkElement.setAttribute('target', '_blank');
                linkElement.setAttribute('rel', 'noopener');
                linkElement.setAttribute('id', iD + '2');
                linkElement.setAttribute('type','bidirectional')
                
                linkElement.appendChild(videoElement.cloneNode(true));
                // Store the current video style
                const videoStyle = videoElement.getAttribute('style');

                linkElement.addEventListener('Click', (event) => {
                  event.preventDefault();
                  
              
                });
                // Add a class to the video element to indicate that the link has been added
                videoElement.parentElement?.classList.add('linked-video');
                videoElement.parentElement?.replaceChild(linkElement, videoElement);
                // Set the stored video style to the new video element
                  const newVideoElement = linkElement.querySelector('video');
                  if (newVideoElement && videoStyle) {
                    newVideoElement.setAttribute('style', '300px');
                    newVideoElement.className = 'linkVideo';
                  }
                  
              }
              }
            }
            
            const linkElement = createLinkElement(firstNoteName, selectedText2);
            element.innerHTML = element.innerHTML.replace(prefix2 + selectedText2 + suffix2, prefix2 + linkElement.outerHTML + suffix2);
           
            document.getElementById(iD+'2')?.onClickEvent((e)=>{
              console.log(e)
              if(firstNoteName===secondNoteName){
                e.preventDefault();
                document.getElementById(iD+'1')?.scrollIntoView({behavior:'smooth'});
              }
                console.log("did assign id")
                navigationTargetID = iD+'1';
              }
            )
            
          }
        }}
        });
        
        if(navigationTargetID !==""){
          let target = document.getElementById(navigationTargetID);
          if(target){
            target.scrollIntoView({behavior:'smooth'});
            
            navigationTargetID="";
            
          }else{
            console.log('did not navigate')
            

          }
        }
    });

    };
    
    
    
    async importWeb() {
      let fileE = await this.app.vault.adapter.exists("Webs Folder/")
        if(!fileE)
        {
            await this.app.vault.createFolder("Webs Folder")
        }
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json'; // Specify the accepted file type as json files
      input.addEventListener('change', async (event) => {
        const files = (event.target as HTMLInputElement).files;
        if (files && files.length > 0) {
          const file = files[0];
          const fileData = await file.text();
          const folderName = 'Webs Folder';
          // Find the folder by its name in the vault
          const folder = this.app.vault.getAbstractFileByPath(folderName);
          if (folder instanceof TFolder) {
            // Creating a new file in the specified folder
            const newFilePath = folder.path + '/' + file.name;
            const newFile = this.app.vault.create(newFilePath, fileData);
            
            if (newFile instanceof TFile) {
              // Writing the file data to the new file
              await this.app.vault.modify(newFile, fileData);
              console.log('File saved:', newFilePath);
            }
            new Notice(`The Web ${file.name} was successfully imported`)
            const webData = JSON.parse(fileData);
            const failedNotes: string[] = [];
            await Promise.all(webData.notes.map(async (note) => {
              try {
                const noteFilePath = (note.noteName + '.md');
                await this.app.vault.create(noteFilePath, note.noteContent);
                console.log('Note created:', noteFilePath);
              } catch (error) {
                console.error('Error creating note:', error);
                failedNotes.push(note.noteName);
              }
            }));
    
            if (failedNotes.length > 0) {
              new Notice(`Failed to imoprt notes with the following names: ${failedNotes.join(', ')}`);
            }
          } else {
            console.log('Folder not found:', folderName);
          }
        }
      });
      input.click();
    }
    exportWeb = async (filePath: string) => {
        const file: TFile | null = this.app.vault.getAbstractFileByPath(filePath) as TFile;
        try {
        const fileData = await this.app.vault.readBinary(file);
        const fileBlob = new Blob([fileData]);
        const fileName = filePath.split('/').pop() || 'untitled';
        saveAs(fileBlob, fileName);
        
        } catch (error) {
        new Notice(`Failed to download file: ${error}`);
        }
        
    };
    createNewWeb = async() => {
      let fileE = await this.app.vault.adapter.exists("Webs Folder/")
      console.log(fileE)
        if(!fileE)
        { 
            await this.app.vault.createFolder("Webs Folder")
            console.log(fileE)
        }
        
      let webName = this.settings.textCreateWebName;
      if(webName){
        this.web.webName = webName;
        //this.web.bidirectionalLinks = []
        
        const jsonContent = JSON.stringify(this.web);

        const webFilePath = "Webs Folder/"+webName +".json";
        
        try{  
         await this.app.vault.adapter.write(webFilePath, jsonContent);
        } catch(error){
                new Notice ("Error with creating a web");
                reportError({message: error.message})
        } 
      }
    };
    async moveLinkToWeb() {
      const currentWeb = await this.app.vault.adapter.read(this.settings.currentWeb);
      const targetWeb = await this.app.vault.adapter.read(this.settings.targetWeb);
      const linkId = this.settings.selectedLinkId;
      const currentWebContent = JSON.parse(currentWeb);
      const targetWebContent = JSON.parse(targetWeb);
      const linkToMove = currentWebContent.bidirectionalLinks.find((link) => link.iD === linkId) ||
      currentWebContent.externalLinks.find((link) => link.iD === linkId) ||
      currentWebContent.linksToHeading.find((link) => link.iD === linkId)||
      currentWebContent.linksToPdfPage.find((link) => link.iD === linkId);
      // Determine from which array the link is being moved
      let noteToMove =[];
      let sourceArray = '';
        if (currentWebContent.bidirectionalLinks.includes(linkToMove)) {
          sourceArray = 'bidirectionalLinks';
          noteToMove.push(currentWebContent.notes.find((note) => note.noteName === linkToMove.firstEndPoint.noteName))
          noteToMove.push(currentWebContent.notes.find((note) => note.noteName === linkToMove.secondEndPoint.noteName))

        } else if (currentWebContent.externalLinks.includes(linkToMove)) {
          sourceArray = 'externalLinks';
          noteToMove.push(currentWebContent.notes.find((note) => note.noteName === linkToMove.sourceText.noteName))
        } else if (currentWebContent.linksToPdfPage.includes(linkToMove)) {
          sourceArray = 'linksToPdfPage';
          noteToMove.push(currentWebContent.notes.find((note) => note.noteName === linkToMove.sourceText.noteName))
        } else if (currentWebContent.linksToHeading.includes(linkToMove)) {
          sourceArray = 'linksToHeading';
          noteToMove.push(currentWebContent.notes.find((note) => note.noteName === linkToMove.sourceText.noteName))
          noteToMove.push(currentWebContent.notes.find((note) => note.noteName === linkToMove.headingNoteName))
        
        }

        if(sourceArray == 'bidirectionalLinks'){
          targetWebContent.bidirectionalLinks.push(linkToMove);
          //targetWebContent.notes.push(...noteToMove);
          for (const note of noteToMove) {
            // Check if the note already exists in the targetWebContent.notes array//some
            const isNoteAlreadyExist = targetWebContent.notes.find((existingNote) => existingNote.noteName === note.noteName);
            // If the note does not already exist, push it to the notes array
            if (!isNoteAlreadyExist) {
              targetWebContent.notes.push(note);
            }
          }
          const updatedLinks = currentWebContent.bidirectionalLinks.filter((link) => link.iD !== linkId);
          currentWebContent.bidirectionalLinks = updatedLinks;
          let updatedIntenalLinksNote;
          for (const note of noteToMove) {
            console.log(note)
            // Check if the noteName exists in any of the arrays
            const foundInLinks = currentWebContent.bidirectionalLinks.find((link) => link.firstEndPoint.noteName === note.noteName ||link.secondEndPoint.noteName === note.noteName );
            const foundInExternalLinks = currentWebContent.externalLinks.find((link) => link.sourceText.noteName === note.noteName);
            const foundInLinksToHeading = currentWebContent.linksToHeading.find((link) => link.sourceText.noteName === note.noteName ||link.headingNoteName === note.noteName);
            console.log(foundInLinks,foundInExternalLinks,foundInLinksToHeading)
            if (!foundInLinks && !foundInExternalLinks && !foundInLinksToHeading) {
              
              updatedIntenalLinksNote = currentWebContent.notes.filter((newNote) => newNote.noteName !== note.noteName)
              currentWebContent.notes = updatedIntenalLinksNote;
            }
          }
          
        } else if(sourceArray == 'externalLinks')
          {
          targetWebContent.externalLinks.push(linkToMove);
          //targetWebContent.notes.push(...noteToMove);
          for (const note of noteToMove) {
            // Check if the note already exists in the targetWebContent.notes array
            const isNoteAlreadyExist = targetWebContent.notes.find((existingNote) => existingNote.noteName === note.noteName);
            // If the note does not already exist, push it to the notes array
            if (!isNoteAlreadyExist) {
              targetWebContent.notes.push(note);
            }
          }
          const updatedExternalLinks = currentWebContent.externalLinks.filter((link) => link.iD !== linkId)
          currentWebContent.externalLinks = updatedExternalLinks;

          let updatedExternalLinksNote;
          for (const note of noteToMove) {
            // Check if the noteName exists in any of the arrays
            const foundInLinks = currentWebContent.bidirectionalLinks.find((link) => link.firstEndPoint.noteName === note.noteName || link.secondEndPoint.noteName === note.noteName );
            const foundInExternalLinks = currentWebContent.externalLinks.find((link) => link.sourceText.noteName === note.noteName);
            const foundInLinksToHeading = currentWebContent.linksToHeading.find((link) => link.sourceText.noteName === note.noteName || link.headingNoteName === note.noteName);
            if (!foundInLinks && !foundInExternalLinks && !foundInLinksToHeading) {
              updatedExternalLinksNote = currentWebContent.notes.filter((newNote) => newNote.noteName !== note.noteName)
              currentWebContent.notes = updatedExternalLinksNote;
            }
            
          }
          
          
        }else if(sourceArray == 'linksToPdfPage')
        {
        targetWebContent.linksToPdfPage.push(linkToMove);
        //targetWebContent.notes.push(...noteToMove);
        for (const note of noteToMove) {
          // Check if the note already exists in the targetWebContent.notes array
          const isNoteAlreadyExist = targetWebContent.notes.find((existingNote) => existingNote.noteName === note.noteName);
          // If the note does not already exist, push it to the notes array
          if (!isNoteAlreadyExist) {
            targetWebContent.notes.push(note);
          }
        }
        const updatedExternalLinks = currentWebContent.linksToPdfPage.filter((link) => link.iD !== linkId)
        currentWebContent.linksToPdfPage = updatedExternalLinks;

        let updatedExternalLinksNote;
        for (const note of noteToMove) {
          // Check if the noteName exists in any of the arrays
          const foundInLinks = currentWebContent.bidirectionalLinks.find((link) => link.firstEndPoint.noteName === note.noteName || link.secondEndPoint.noteName === note.noteName );
          const foundInExternalLinks = currentWebContent.externalLinks.find((link) => link.sourceText.noteName === note.noteName);
          const foundInPdfLinks = currentWebContent.linksToPdfPage.find((link) => link.sourceText.noteName === note.noteName);
          const foundInLinksToHeading = currentWebContent.linksToHeading.find((link) => link.sourceText.noteName === note.noteName || link.headingNoteName === note.noteName);
          if (!foundInLinks && !foundInExternalLinks && !foundInLinksToHeading && foundInPdfLinks) {
            updatedExternalLinksNote = currentWebContent.notes.filter((newNote) => newNote.noteName !== note.noteName)
            currentWebContent.notes = updatedExternalLinksNote;
          }
          
        }
        
        
        }else if(sourceArray == 'linksToHeading'){
          targetWebContent.linksToHeading.push(linkToMove);
          //targetWebContent.notes.push(...noteToMove);
          for (const note of noteToMove) {
            // Check if the note already exists in the targetWebContent.notes array
            const isNoteAlreadyExist = targetWebContent.notes.find((existingNote) => existingNote.noteName === note.noteName);
            // If the note does not already exist, push it to the notes array
            if (!isNoteAlreadyExist) {
              targetWebContent.notes.push(note);
            }
          }
          const updatedHeadingLinks = currentWebContent.linksToHeading.filter((link) => link.iD !== linkId)
          currentWebContent.linksToHeading = updatedHeadingLinks;
          let updatedHeadingNote;
          for (const note of noteToMove) {
            // Check if the noteName exists in any of the arrays
            const foundInLinks = currentWebContent.bidirectionalLinks.find((link) => link.firstEndPoint.noteName === note.noteName ||link.secondEndPoint.noteName === note.noteName );
            const foundInExternalLinks = currentWebContent.externalLinks.find((link) => link.sourceText.noteName === note.noteName);
            const foundInLinksToHeading = currentWebContent.linksToHeading.find((link) => link.sourceText.noteName === note.noteName ||link.headingNoteName === note.noteName);

            if (!foundInLinks && !foundInExternalLinks && !foundInLinksToHeading) {
              
              updatedHeadingNote = currentWebContent.notes.filter((newNote) => newNote.noteName !== note.noteName)
              currentWebContent.notes = updatedHeadingNote;
            }
            
          }
          
        }
        const jsonContent1 = JSON.stringify(currentWebContent);
        const jsonContent2 = JSON.stringify(targetWebContent);
        // Save the updated content back to the files
        await this.app.vault.adapter.write(this.settings.currentWeb, jsonContent1);
        await this.app.vault.adapter.write(this.settings.targetWeb, jsonContent2);

        this.saveSettings();
    }
    searchLinksByDate = async (selectedDate: string,searchScope: string) => {
          if(searchScope==='current'){
            const linkFilePath = this.settings.currentWeb;
            let webContent = await this.app.vault.adapter.read(linkFilePath);
            let web = JSON.parse(webContent);
            // Merge all link arrays into one using the concat method
            const linksOnSelectedDate = web.bidirectionalLinks
            .concat(web.externalLinks, web.linksToHeading,web.linksToPdfPage)
            .filter((link) => {
              // Parse the creationTime into a Date object and extract the date part
              const creationTimeDate = parseCustomDate(link.creationTime);
              const creationDate = creationTimeDate.toISOString().split('T')[0];
        
              // Extract the date part from the selected date
              const selectedDatePart = selectedDate.split('T')[0];
        
              // Check if the dates match
              return creationDate === selectedDatePart;
            });
            if (linksOnSelectedDate.length === 0) {
              new Notice('No links found on the selected date.');
              return [];
            }
            return linksOnSelectedDate;
          }
          else if(searchScope ==='all'){
          const folderName = 'Webs Folder';
          let filesPath =[];
          let linksOnSelectedDate = [];
          const folder = this.app.vault.getAbstractFileByPath(folderName);
            if (folder instanceof TFolder) {
              folder.children.forEach((child)=>{
                filesPath.push(child.path);
              })
          }

          for(let i =0; i<filesPath.length;i++)
        {
          //const linkFilePath = this.settings.currentWeb;
          let linkFilePath = filesPath[i]
          let webContent = await this.app.vault.adapter.read(linkFilePath);
          let web = JSON.parse(webContent);
        
          // Merge all link arrays into one using the concat method
          let linksOnSelectedDate1 = web.bidirectionalLinks
            .concat(web.externalLinks, web.linksToHeading,web.linksToPdfPage)
            .filter((link) => {
              // Parse the creationTime into a Date object and extract the date part
              const creationTimeDate = parseCustomDate(link.creationTime);
              const creationDate = creationTimeDate.toISOString().split('T')[0];
        
              // Extract the date part from the selected date
              const selectedDatePart = selectedDate.split('T')[0];
        
              // Check if the dates match
              return creationDate === selectedDatePart;
              

            });
            linksOnSelectedDate1.forEach(link => {
              linksOnSelectedDate.push({"link":link,"web": web.webName});
            });
            
            linksOnSelectedDate1 = []
            
          }
          if (linksOnSelectedDate.length === 0) {
            new Notice('No links found on the selected date.');
            return [];
          }
          return linksOnSelectedDate;
          }
          
        
    };
    
    searchLinksByKeyword = async (keyword: string,searchScope:string) => {
      if(searchScope==='current'){
      const linkFilePath = this.settings.currentWeb;
      let webContent = await this.app.vault.adapter.read(linkFilePath);
      let web = JSON.parse(webContent);
    
      const linksWithKeyword = web.bidirectionalLinks
        .concat(web.externalLinks, web.linksToHeading,web.linksToPdfPage)
        .filter((link) => {
          // Check if the keyword is present in the link title or link explainer
          //return link.linkKeyWord.toLowerCase().includes(keyword.toLowerCase());
          return link.linkKeyWord.toLowerCase() === keyword.toLowerCase();
          
        });

      if (linksWithKeyword.length === 0) {
        new Notice(`No links found with the keyword "${keyword}".`);
        return [];
      }
    
      return linksWithKeyword;
    }
    else if(searchScope==='all'){
          const folderName = 'Webs Folder';
          let filesPath =[];
          let linksWithKeyword = [];
          const folder = this.app.vault.getAbstractFileByPath(folderName);
            if (folder instanceof TFolder) {
              folder.children.forEach((child)=>{
                filesPath.push(child.path);
              })
          }
          for(let i =0; i<filesPath.length;i++)
          {
            let linkFilePath = filesPath[i]
            let webContent = await this.app.vault.adapter.read(linkFilePath);
            let web = JSON.parse(webContent);
            let linksWithKeyword1 = web.bidirectionalLinks
              .concat(web.externalLinks, web.linksToHeading,web.linksToPdfPage)
              .filter((link) => {
              // Check if the keyword is present in the link title or link explainer
              return link.linkKeyWord.toLowerCase() === keyword.toLowerCase();
          
        });
       
        linksWithKeyword1.forEach(link => {
          linksWithKeyword.push({"link":link,"web": web.webName});
        });
        
        linksWithKeyword1 = []
    
      }
      if (linksWithKeyword.length === 0) {
        new Notice(`No links found with the keyword "${keyword}".`);
        return [];
      }
    
      return linksWithKeyword;
    }
    };
    
    onunload() {
    new Notice('Plugin Disabled');
    }
}

function escapeReg(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
 
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
function getHeadingNames(noteContent: string): string[] {
    const regex = /^#+\s*(.*)$/gm;
    const matches = noteContent.matchAll(regex);
    const headingNames: string[] = [];
    for (const match of matches) {
      const headingName = match[1];
      headingNames.push(headingName);
    }
    return headingNames;
}
  
function parseCustomDate(dateString: string): Date {
  const [datePart, timePart] = dateString.split(', ');
  const [day, month, year] = datePart.split('/');
  const [time, amOrPm] = timePart.split(' ');
  const [hour, minute, second] = time.split(':');

  let parsedHour = parseInt(hour, 10);
  if (amOrPm === 'PM') {
    parsedHour += 12;
  }

  return new Date(
    parseInt(year, 10),
    parseInt(month, 10) - 1,
    parseInt(day, 10),
    parsedHour,
    parseInt(minute, 10),
    parseInt(second, 10)
  );
}
function isSingleLineSelection(editor: Editor, selectionText:string) {
  const lines = selectionText.split('\n');
  return lines.length === 1;
}
function calculateSimilarityPercentage(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const dp: number[][] = [];
  for (let i = 0; i <= len1; i++) {
    dp[i] = [];
    for (let j = 0; j <= len2; j++) {
      dp[i][j] = 0;
    }
  }

 
  for (let i = 0; i <= len1; i++) {
    dp[i][0] = i;
  }
  for (let j = 0; j <= len2; j++) {
    dp[0][j] = j;
  }

 
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, 
        dp[i][j - 1] + 1, 
        dp[i - 1][j - 1] + cost
      );
    }
  }
  const editDistance = dp[len1][len2];
  const maxLength = Math.max(len1, len2);
  const similarityPercentage = ((maxLength - editDistance) / maxLength) * 100;
  return similarityPercentage;
}