# selenium-driver.py
import pickle
import os
import zipfile
import time
import csv
from random import randrange
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.keys import Keys
from bs4 import BeautifulSoup
import pandas as pd
import re
from os import path
from webdriver_manager.chrome import ChromeDriverManager
from fake_headers import Headers, browsers
import platform

urlBase ='https://www.idealista.pt'
urlLogin = 'https://www.idealista.pt/login'

dtypes = {'IdImovel':'str',
    'UrlPesquisa':'str',
    'Url':'str',
    'Nome':'str',
    'Preco':'str',
    'PrecoDesconto':'str',
    'tipo':'str',
    'metros':'str',
    'andar':'str',
    'elevador':'str',
    'Detalhes':'str',
    'Status':'str',
    }

dtypesDet = {
	'IdImovel':  'str',
	'Caracteristicas':  'str',
	'Comentario':  'str',
	'Detalhes':  'str',
	'Endereco' :  'str',
	'Latitude' :  'str',
	'Longitude':  'str',
	'ad_builtType': 'str',
	'ad_characteristics_bathNumber': 'str',
	'ad_characteristics_constructedArea': 'str',
	'ad_characteristics_hasGarden': 'str',
	'ad_characteristics_hasLift': 'str', 
	'ad_characteristics_hasParking': 'str',
	'ad_characteristics_hasSwimmingPool': 'str',
	'ad_characteristics_hasTerrace': 'str',
	'ad_characteristics_roomNumber': 'str',
	'ad_condition_isGoodCondition': 'str',
	'ad_condition_isNeedsRenovating': 'str',
	'ad_condition_isNewDevelopment': 'str',
	'ad_energyCertification_suffix': 'str',
	'ad_energyCertification_type': 'str', 
	'ad_hasRecommended': 'str',
	'ad_id': 'str',
	'ad_isAuction': 'str',
	'ad_isRecommended': 'str',
	'ad_media_has3Dtour': 'str',
	'ad_media_hasFloorPlan': 'str',
	'ad_media_photoNumber': 'str',
	'ad_media_videoNumber': 'str',
	'ad_numberRecommended': 'str',
	'ad_operation': 'str',
	'ad_origin': 'str',
	'ad_originTypeRecommended': 'str',
	'ad_owner_commercialId': 'str',
	'ad_owner_commercialName': 'str',
	'ad_owner_contactPreference': 'str',
	'ad_owner_type': 'str',
	'ad_price': 'str',
	'ad_recommendationId': 'str',
	'ad_typology':'str'
}

class SeleniumDriver(object):

    def __init__(
        self,
        # chromedriver path
        driver_path=r'C:\Users\HP ProBook 640\Desktop\Selenium\chromedriver_win32\chromedriver.exe',
        # pickle file path to store cookies
        cookies_file_path=r'C:\Users\HP ProBook 640\source\repos\IdealistaScraper\cookies.pkl',
        # list of websites to reuse cookies with
        cookies_websites=["https://www.idealista.pt"],
        use_proxy = False

    ):
        ## ADICINANDO FAKE HEADERS
        OSNAME = platform.system()
        #
        header = Headers(
            browser="chrome",
            os=OSNAME,
            headers=False
        ).generate()
        agent = header['User-Agent']
        ##---------------------------

        ## ALTERAÇÃO PARA USAR O PROXY####

        PROXY_HOST = 'proxy.proxy-cheap.com'  # rotating proxy
        PROXY_PORT = 31112
        PROXY_USER = 'ma1htlpv'
        PROXY_PASS = 'Gy82UPoCVr5WfEfn'


        manifest_json = """
        {
            "version": "1.0.0",
            "manifest_version": 2,
            "name": "Chrome Proxy",
            "permissions": [
                "proxy",
                "tabs",
                "unlimitedStorage",
                "storage",
                "<all_urls>",
                "webRequest",
                "webRequestBlocking"
            ],
            "background": {
                "scripts": ["background.js"]
            },
            "minimum_chrome_version":"22.0.0"
        }
        """

        background_js = """
        var config = {
                mode: "fixed_servers",
                rules: {
                  singleProxy: {
                    scheme: "http",
                    host: "%s",
                    port: parseInt(%s)
                  },
                  bypassList: ["localhost"]
                }
              };

        chrome.proxy.settings.set({value: config, scope: "regular"}, function() {});

        function callbackFn(details) {
            return {
                authCredentials: {
                    username: "%s",
                    password: "%s"
                }
            };
        }

        chrome.webRequest.onAuthRequired.addListener(
                    callbackFn,
                    {urls: ["<all_urls>"]},
                    ['blocking']
        );
        """ % (PROXY_HOST, PROXY_PORT, PROXY_USER, PROXY_PASS)



        ##################################3
        self.driver_path = driver_path
        self.cookies_file_path = cookies_file_path
        self.cookies_websites = cookies_websites
        chrome_options = webdriver.ChromeOptions()
        
        ## ADICIONANDO OPTIONS

        if use_proxy:
            pluginfile = 'proxy_auth_plugin.zip'

            with zipfile.ZipFile(pluginfile, 'w') as zp:
                zp.writestr("manifest.json", manifest_json)
                zp.writestr("background.js", background_js)
            chrome_options.add_extension(pluginfile)
        
        #chrome_options.add_argument("--log-level=3")
        #chrome_options.add_experimental_option(
        #    "excludeSwitches", ["enable-automation", "enable-logging"])
        #chrome_options.add_experimental_option('useAutomationExtension', False)
        #chrome_options.add_argument(f"user-agent={agent}")
        #chrome_options.add_argument('--disable-features=UserAgentClientHint')
        #webdriver.DesiredCapabilities.CHROME['loggingPrefs'] = {
        #    'driver': 'OFF', 'server': 'OFF', 'browser': 'OFF'}
        #---------------------

        self.driver = webdriver.Chrome(
            executable_path = driver_path,
            options=chrome_options
        )
        try:
            # load cookies for given websites
            cookies = pickle.load(open(self.cookies_file_path, "rb"))
            for website in self.cookies_websites:
                self.driver.get(website)
                for cookie in cookies:
                    self.driver.add_cookie(cookie)
                self.driver.refresh()
        except Exception as e:
            # it'll fail for the first time, when cookie file is not present
            print(str(e))
            print("Error loading cookies")

    def save_cookies(self):
        # save cookies
        cookies = self.driver.get_cookies()
        pickle.dump(cookies, open(self.cookies_file_path, "wb"))

    def close_all(self):
        # close all open tabs
        if len(self.driver.window_handles) < 1:
            return
        for window_handle in self.driver.window_handles[:]:
            self.driver.switch_to.window(window_handle)
            self.driver.close()

    def quit(self):
        self.save_cookies()
        self.close_all()
        self.driver.quit()



def is_idealista_logged_in(driver,message =['idealista — Moradias e apartamentos, arrendamento e venda, anúncios gratuitos']):
    time.sleep(5)
    try:
         iframe = driver.find_element_by_xpath("/html/body/iframe")
         driver.switch_to.frame(iframe)
         x = driver.find_element_by_xpath('//*[@id="captcha-container"]/div[3]/div/div[1]')
         driver.switch_to.default_content()
         return False
    except:
        driver.switch_to.default_content()
        return True

    for elem in message:
        if elem in driver.title:
            return  True
    return False

def trata_captcha(driver,msg):

    message = ''
    try:
        # Pega o XPath do iframe e atribui a uma variável
        iframe = driver.find_element_by_xpath("/html/body/iframe")

        # Muda o foco para o iframe
        driver.switch_to.frame(iframe)
                                                           
        message = driver.find_element_by_xpath('//*[@id="captcha-container"]/div[3]/div/div[1]').text
        #Mensagem = 'Foram detetados vários pedidos teus em pouco tempo.'

        # Retorna para a janela principal (fora do iframe)
        driver.switch_to.default_content()
        
    except :
        pass

    if message == '':
        try:
            WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.XPATH,'/html/body/div[1]/div/div/div/div/div[2]/button[2]')))
            
            driver.find_element(By.XPATH,"/html/body/div[1]/div/div/div/div/div[2]/button[2]").click()
        except:
            pass
    elif message == 'Foram detetados vários pedidos teus em pouco tempo.':
        print('aguarda passa no captcha')

        while is_idealista_logged_in(driver, msg) == False:
            time.sleep(50)
        try:
            driver.find_element(By.ID,"didomi-notice-agree-button").click()
        except :
            pass
def idealista_login(driver,username, password):


    #precisa tratar tela de captcha
    driver.get(urlBase)
    time.sleep(4) 
    msg ='idealista — Moradias e apartamentos, arrendamento e venda, anúncios gratuitos'
    trata_captcha(driver,msg)
        

def idealista_monta_url_pesquisa(tipo,cidade, zona=''):
    urlPesquisa = ''

    if tipo == 'arrendar':
        tipo = 'arrendar-casas'
    elif tipo == 'comprar':
        tipo = 'comprar-casas'

    if cidade !='':
        urlPesquisa = '{}/{}/{}/'.format(urlBase,tipo,cidade)
    if zona !='':
        urlPesquisa = urlPesquisa + '{}/'.format(zona)
    return urlPesquisa
def idealista_pesquisa(driver, tipo, cidade, zona = ''):
   
   # # Pesquisa pelo texto
   # pesquisa = driver.find_element(By.ID, "campoBus")
   # pesquisa.send_keys(txtPesquisa)
   #
   # # Clica no botão Pesquisa
   # btnPesquisa = driver.find_element(By.ID, "btn-free-search")
   # btnPesquisa.click()

    urlPesquisa = idealista_monta_url_pesquisa(tipo, cidade, zona)
    driver.get(urlPesquisa)
    
    try:
        WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID,"didomi-notice-agree-button")))
        driver.find_element(By.ID,"didomi-notice-agree-button").click()
    except :
        pass
    return urlPesquisa
def paginacao(driver, urlPesquisa, cidade,dtypes):
    hasPagination = True
    df_imoveis=''
    page = 1
    while hasPagination:  
        ### VERIFICA CAPTCHA
        try:
            x = driver.find_element(By.XPATH,'//*[@id="main-content"]/section[1]/article[1]/div/a')
        except :
            trata_captcha(driver,'Casas e apartamentos para arrendar')


        ###METODO SCRAPE
        listaImoveis = idealista_scrape_imoveis_links(driver,urlPesquisa, page)
        df_imoveis = SaveDFtoCsv('', cidade,listaImoveis,dtypes)
        try:
            WebDriverWait(driver, 4).until(EC.presence_of_element_located((By.LINK_TEXT, "Seguinte")))
            driver.find_element(By.LINK_TEXT, "Seguinte").click()
            page = page + 1
            urlPesquisa = driver.current_url
            time.sleep(randrange(3,6))
        except:
            hasPagination = False
    return df_imoveis
def idealista_scrape_imoveis_links(driver, urlPesquisa, page):
    listaImoveis =[]
    #Pega todos artigos
    soup = BeautifulSoup(driver.page_source, 'lxml')

    articles = soup.find_all('article')
    list_info_container = [article.find("div", {'class': 'item-info-container'}) for article in articles]

    for _info in list_info_container:
        dic_imovel={}
        IdImovel = ''
        UrlPesquisa = urlPesquisa
        Url = ''
        Nome = ''
        Preco = ''
        PrecoDesconto = ''
        tipo = ''
        metros = ''
        andar = ''
        elevador = ''
        Detalhes = ''
        Status = ''
        
        try:
            info = _info.find("a",{'class' : 'item-link'})
            if info != None:
                Url = info['href']
                p = re.compile(r'\d+')
                IdImovel = p.findall(Url)[0]
                Nome = info['title']

            
            #infoPreco = _info.find_all("span",{'class' : 'item-price'})
            #Preco = str(infoPreco[0].text.replace('€/mês',''))
            
            ####### PRECO DO IMOVEL
            pricerow = _info.find('div',{'class' : 'price-row'})
            if pricerow is not None:
                priceElement = pricerow.find("span",{'class' : 'item-price'})
                if priceElement is not None:
                    Preco = priceElement.text.replace('€/mês','').strip()

                priceDownElement = pricerow.find("span",{'class' : 'pricedown_price'})
                if priceDownElement is not None:
                    PrecoDesconto = priceDownElement.text.replace('€','').strip()

            
            ######## DETALHES DO IMOVEL
            infoDetalhes = _info.find_all("span",{'class' : 'item-detail'})
            if infoDetalhes != None:
                Detalhes = ', '.join([detalhe.text for detalhe in infoDetalhes])
             
                if  ('andar' in Detalhes) or ('Rés do chão' in Detalhes) or ('Cave' in Detalhes):
                    for detalhe in infoDetalhes:
                        if 'andar' in detalhe.text:
                            andar = detalhe.text.strip()

                            if detalhe.find("small") is not None:
                                elevador = detalhe.find("small").text.strip()
                            else:
                                elevador = ''

                            andar = andar.replace(elevador, '')
                            andar = andar.replace('º andar','')
                    
                        if 'Rés do chão' in detalhe.text:
                            andar = '0'

                        if 'Cave' in detalhe.text:
                            andar = '-1'   
                else:
                    andar = ''
            
                if 'elevador' in Detalhes:
                    for detalhe in infoDetalhes:
                        if 'elevador' in detalhe.text:
                            if detalhe.find("small") is not None:
                                elevador = detalhe.find("small").text.strip()
                            else:
                                elevador = ''
                else:
                    elevador = ''


                tipo = infoDetalhes[0]
                if tipo is not None:
                    tipo = tipo.text.strip()

                metros = infoDetalhes[1]
                if metros is not None:
                    metros = metros.text.strip()
                    metros = metros.replace('m² construídos','')


            dic_imovel = {
                'IdImovel':str(IdImovel),
                'UrlPesquisa':str(UrlPesquisa),
                'Url':str(Url),
                'Nome':str(Nome),
                'Preco':str(Preco),
                'PrecoDesconto': str(PrecoDesconto),
                'tipo':str(tipo),
                'metros':str(metros),
                'andar':str(andar),
                'elevador':str(elevador),
                'Detalhes':str(Detalhes),
                'Status':str(Status),
                'Page':str(page)
            }

            listaImoveis.append(dic_imovel)
        except:
            pass

        #try:
        #    andar = infoDetalhes[2].text.strip()
        #    listaImoveis['andar'].append(andar)
        #except :
        #    listaImoveis['andar'].append('')
         
    return listaImoveis
def idealista_imoveis_detalhes(driver, url, titulo):
    #inicializa variaveis
    IdImovel=''
    Caracteristicas	=''
    Comentario=''
    Detalhes=''
    Endereco=''
    Latitude=''
    Longitude=''
    

    #Define o Titulo, para validar
    #title = "Arrendamento de " + str(titulo) + " — idealista"

    #requisiçao pagina
    url = r'https://www.idealista.pt' + url
    headers = ({'User-Agent':
            'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36'})
    time.sleep(3)
    driver.get(url
               )
       ### VERIFICA CAPTCHA
    try:
        anuncio_desativado = driver.find_element(By.XPATH,'//*[@id="main"]/div/div/main/section/div')
        if anuncio_desativado != None:
            if 'Lamentamos' in anuncio_desativado.text:
                ret = False
                return ret
    except:
        pass
    try:
        anuncio_suspeito = driver.find_element(By.XPATH,'//*[@id="main"]/div/div/section/div/div/h1')
        if anuncio_suspeito != None:
            ret = False
            return ret
    except :
        pass

    try:
        anuncio_nao_encontrado = driver.find_element(By.XPATH,'//*[@id="main"]/div/div/section')
        if anuncio_nao_encontrado != None:
            ret = False
            return ret
    except :
        pass

    try:
        anuncio_com_titulo = driver.find_element(By.XPATH,'//*[@id="main"]/div/main/section[1]/div[2]')
    except:
        trata_captcha(driver,['Arrendamento','arrendar'])

    
    try:
        WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.XPATH,'/html/body/div[2]/div/div/main/section[1]/div[2]')))
    except :
        return
    
    soup = BeautifulSoup(driver.page_source, 'lxml')
    
    # ID do Imovel
    p = re.compile(r'\d+')
    IdImovel = p.findall(url)[0]

    #Div com os dados metros construidos  
    try:
        info_features = soup.find("div", {'class' : 'info-features'})
        features = list(dict.fromkeys([span.text.strip() for span in info_features.find_all("span")]))
        if features is not None:
            Caracteristicas = ','.join(features)
    except :
        Caracteristicas = ''

    #Div com os comentarios do Vendedor 
    try:
        info_comment = soup.find("div", {'class' : 'comment'})
        if info_comment.find("p") is not None:
            Comentario = info_comment.find("p").text.strip()
        else:
            Comentario =''
    except :
        Comentario =''

    #Div detalhes do imovel
    try:
        info_details = soup.find("div", {'class' : 'details-property'})
        if info_details is not None:
            info_details_one = info_details.find("div", {'class' : 'details-property-feature-one'})
            details_one = [li.text.strip() for li in info_details_one.find_all("li")]	
        else:
            details_one=''
                
        info_details_two = info_details.find("div", {'class' : 'details-property-feature-two'})
        if info_details_two is not None:
            details_two = [li.text.strip() for li in info_details_two.find_all("li")]
        else:
            details_two = ''

        info_details_three = info_details.find("div", {'class' : 'details-property-feature-three'})
        if info_details_three is not None:
            details_three = [li.text.strip() for li in info_details_three.find_all("li")]	
        else:
            details_three = ''

        all_details = details_one + details_two + details_three
        Detalhes = ','.join(all_details)
    except :
        Detalhes = ''
    # Div de localizacao

    try:
        info_location = soup.find("div", {'id' : 'mapWrapper'})
        info_location_address =  info_location.find("div", {'class' : 'clearfix'})
        if info_location_address is not None:
            location_address = [li.text.strip() for li in info_location_address.find_all("li")]	
            Endereco = ' '.join(location_address)
        else:
            Endereco=''

        info_map_config = driver.execute_script('return mapConfig')
        #location_lat = {'Latitude':info_map_config['latitude'], 'Longitude': info_map_config['longitude']}
        Latitude = info_map_config['latitude']
        Longitude = info_map_config['longitude']
    except :
        Endereco=''
        Latitude=''
        Longitude=''

    #info estatisticas
    try:
        info_stats = soup.find("div", {'id' : 'stats'})

    except :
        pass

    ImovelDetalhes = {
            'IdImovel': IdImovel,
            'Caracteristicas': Caracteristicas,
            'Comentario': Comentario,
            'Detalhes': Detalhes,
            'Endereco' : Endereco,
            'Latitude' : Latitude,
            'Longitude': Longitude
        }

    #outras infos
    try:
        info_utag_data = driver.execute_script('return utag_data')
        utag_data_filter = \
        ['ad_builtType',
        'ad_characteristics_bathNumber',
        'ad_characteristics_constructedArea',
        'ad_characteristics_hasGarden',
        'ad_characteristics_hasLift', 
        'ad_characteristics_hasParking',
        'ad_characteristics_hasSwimmingPool',
        'ad_characteristics_hasTerrace',
        'ad_characteristics_roomNumber',
        'ad_condition_isGoodCondition',
        'ad_condition_isNeedsRenovating',
        'ad_condition_isNewDevelopment',
        'ad_energyCertification_suffix',
        'ad_energyCertification_type', 
        'ad_hasRecommended',
        'ad_id',
        'ad_isAuction',
        'ad_isRecommended',
        'ad_media_has3Dtour',
        'ad_media_hasFloorPlan',
        'ad_media_photoNumber',
        'ad_media_videoNumber',
        'ad_numberRecommended',
        'ad_operation',
        'ad_origin',
        'ad_originTypeRecommended',
        'ad_owner_commercialId',
        'ad_owner_commercialName',
        'ad_owner_contactPreference',
        'ad_owner_type',
        'ad_price',
        'ad_recommendationId',
        'ad_typology']



        utag_data = {k:v for k,v in info_utag_data.items() if k in utag_data_filter}
        for x in utag_data_filter:
            if x in utag_data.keys():
                for k,v in utag_data.items():
                    if x == k:
                        ImovelDetalhes[k] = v
            else:
                ImovelDetalhes[x] = ''

    except :
        for x in utag_data_filter:
            ImovelDetalhes[x] = ''
    lstImovelDetalhes = []
    lstImovelDetalhes.append(ImovelDetalhes)
    ret = True
    if  (IdImovel=='' and Caracteristicas =='' and Endereco =='' and Latitude ==''):
        ret =  False
    else:
        SaveDFtoCsv('', 'BaseDetalhesImovel', lstImovelDetalhes, dtypesDet)
        ret = True
    return ret

def SaveDFtoCsv(pathfile, fileName, lst, dtypes):


    filepath = str(pathfile)+(fileName)+str('.csv')
    if lst is not None:
        df_new = pd.DataFrame(lst)
        df_new.drop_duplicates(subset=['IdImovel'], inplace=True, keep='first')
  
        if path.exists(filepath):
            df_old = pd.read_csv(filepath, delimiter=";", dtype=dtypes)
            #df_old = pd.read_csv(filepath, delimiter=";", quoting=csv.QUOTE_NONNUMERIC).replace('"','', regex=True)
            df_old.drop_duplicates(subset=['IdImovel'], inplace=True, keep='first')

            df3 = pd.concat([df_new,df_old])
            df3.drop_duplicates(subset=['IdImovel'], inplace=True, keep='first')
            df3.to_csv(filepath, sep=';',index=False, quoting=csv.QUOTE_ALL, encoding='utf-8')
            #df3.to_csv(filepath, sep=';',index=False, quoting=csv.QUOTE_NONNUMERIC, quotechar='"',encoding='utf-8')
            return df3
        else:
            df_new.to_csv(filepath, sep=';',index=False, quoting=csv.QUOTE_ALL, encoding='utf-8')
            #df_new.to_csv(filepath, sep=';',index=False, quoting=csv.QUOTE_NONNUMERIC, quotechar='"',encoding='utf-8')
            return df_new
    else:
        df_old = pd.read_csv(filepath, delimiter=";")
        return df_old
def UpdateCsvUrl(pathfile, fileName,IdImovel, dtypes, status):
    
    filepath = str(pathfile)+(fileName)+str('.csv')
    if path.exists(filepath):
        df = pd.read_csv(filepath, delimiter=";", dtype=dtypes)
        #df = pd.read_csv(filepath, delimiter=";", quoting=csv.QUOTE_NONNUMERIC).replace('"','', regex=True)
        df.drop_duplicates(subset=['IdImovel'], inplace=True, keep='first')
        df.loc[df["IdImovel"] == str(IdImovel), 'Status'] = status
        df.to_csv(filepath, sep=';',index=False, quoting=csv.QUOTE_ALL, encoding='utf-8')


if __name__ == '__main__':
    """
    Run  - 1
    First time authentication and save cookies

    Run  - 2
    Reuse cookies and use logged-in session
    """
    selenium_object = SeleniumDriver()
    driver = selenium_object.driver
   
    
    username = "johnscosta2009@hotmail.com"
    password = "johnosd123"
    tipo = 'arrendar'

    
    #if is_idealista_logged_in(driver) == False:
    #    print("Not logged in. Login")
    #    idealista_login(driver,username,password)


    tipoScrape = '2'

    lst_filelistImoveis = ['porto-distrito']
    time.sleep(3)
    tipo='arrendar-casas'
    zona=''
    counter = 0
    if tipoScrape == '1':
        for filelistImoveis in lst_filelistImoveis:
            cidade = filelistImoveis
            fileDetImoveis = '{}-detalhe'.format(filelistImoveis)
            
            ulrPesquisa = idealista_pesquisa(driver,tipo,cidade,zona)
            df_imoveis = paginacao(driver,ulrPesquisa,filelistImoveis,dtypes)
            #selenium_object.quit()
            tipoScrape=''
            cidade = ''
            zona = ''
        
    elif tipoScrape == '2':
        for filelistImoveis in lst_filelistImoveis:

            if path.exists(filelistImoveis+str('.csv')):
                df_imoveis = pd.read_csv((filelistImoveis+str('.csv')), delimiter=";")
                for ind in df_imoveis.index:
                    if counter == 3000:
                        counter = 0
                        selenium_object.quit()
                        selenium_object = SeleniumDriver()
                        driver = selenium_object.driver

                
                    if df_imoveis['Status'][ind] not in ['OK','NOK']:
                        counter = counter + 1

                        url = str(df_imoveis['Url'][ind])
                        nome = str(df_imoveis['Nome'][ind])
                        ret = idealista_imoveis_detalhes(driver,url,nome)
                        status = 'OK'
                        if ret != True:
                            status = 'NOK'
                       
                        UpdateCsvUrl('', filelistImoveis,df_imoveis['IdImovel'][ind],dtypes, status)

       




